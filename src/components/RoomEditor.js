import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { codeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const LANGUAGE_MAP = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  JAVA: 'java',
  CPP: 'cpp',
  C: 'c'
};

const isValidUuid = (val) =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const RoomEditor = ({
  roomId,
  language = 'JAVASCRIPT',
  fontSize = 14,
  initialContent = '',
  initialRevision = 0,
  socketManager,
  onCodeChangeRef
}) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Keep live references to socketManager and user to prevent stale closures
  const socketManagerRef = useRef(socketManager);
  socketManagerRef.current = socketManager;

  const userRef = useRef(user);
  userRef.current = user;

  const [initialLoading, setInitialLoading] = useState(!initialContent);
  const currentRevision = useRef(initialRevision || 0);
  const isRemoteChange = useRef(false);
  const clientIdRef = useRef('client-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now());

  // Debounced full sync timer reference
  const fullSyncTimerRef = useRef(null);

  // Peer cursor decorations storage: Map<userId, decorationIds[]>
  const peerDecorationsRef = useRef(new Map());

  // Monaco event listener disposables
  const listenerDisposablesRef = useRef([]);

  // Load initial code snapshot from REST API
  const loadInitialCode = useCallback(async () => {
    try {
      const data = await codeApi.getCode(roomId);
      if (data) {
        currentRevision.current = data.revision || 0;
        if (editorRef.current) {
          const currentVal = editorRef.current.getValue();
          const targetVal = data.content != null ? data.content : '';
          if (currentVal !== targetVal) {
            isRemoteChange.current = true;
            editorRef.current.setValue(targetVal);
            isRemoteChange.current = false;
          }
        }
      }
    } catch (err) {
      console.error('[DevCollab] Failed to load initial code from backend:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadInitialCode();
  }, [loadInitialCode]);

  // Expose current code retrieval helper
  useEffect(() => {
    if (onCodeChangeRef) {
      onCodeChangeRef.current = () => {
        return editorRef.current ? editorRef.current.getValue() : '';
      };
    }
  }, [onCodeChangeRef]);

  // Attach Monaco listeners that read live socketManager & user refs
  const setupEditorListeners = (editor) => {
    // Dispose previous listeners if any
    listenerDisposablesRef.current.forEach((d) => {
      try { d.dispose(); } catch (e) {}
    });
    listenerDisposablesRef.current = [];

    // 1. Listen to local cursor movements and publish
    const cursorDisp = editor.onDidChangeCursorPosition((e) => {
      if (isRemoteChange.current) return;
      const socket = socketManagerRef.current;
      if (socket && (socket.connected || socket.client?.connected)) {
        socket.sendCursor(e.position.lineNumber, e.position.column);
      }
    });
    listenerDisposablesRef.current.push(cursorDisp);

    // 2. Listen to local typing changes and publish deltas
    const contentDisp = editor.onDidChangeModelContent((event) => {
      if (isRemoteChange.current) return;

      const socket = socketManagerRef.current;
      if (!socket || (!socket.connected && !socket.client?.connected)) {
        console.warn('[DevCollab] WebSocket not connected, edit not broadcasted');
        return;
      }

      const model = editor.getModel();
      if (!model) return;

      const fullContent = model.getValue();
      const currentUser = userRef.current;
      const validUserId = isValidUuid(currentUser?.id) ? currentUser.id : undefined;

      event.changes.forEach((change) => {
        const isDelete = change.rangeLength > 0;
        const isInsert = Boolean(change.text && change.text.length > 0);

        let type = null;
        if (isDelete && isInsert) {
          type = 'REPLACE';
        } else if (isDelete) {
          type = 'DELETE';
        } else if (isInsert) {
          type = 'INSERT';
        }

        if (type) {
          socket.sendCodeEdit({
            clientId: clientIdRef.current,
            ...(validUserId ? { userId: validUserId } : {}),
            type,
            position: change.rangeOffset,
            text: change.text || '',
            length: change.rangeLength || 0,
            range: {
              startLineNumber: change.range.startLineNumber,
              startColumn: change.range.startColumn,
              endLineNumber: change.range.endLineNumber,
              endColumn: change.range.endColumn
            },
            revision: currentRevision.current,
            fullContent
          });
        }
      });

      // Debounce a full-sync broadcast backup (1.5s after typing pauses)
      // Guarantees room-wide consistency even if a packet is delayed or dropped
      if (fullSyncTimerRef.current) {
        clearTimeout(fullSyncTimerRef.current);
      }
      fullSyncTimerRef.current = setTimeout(() => {
        const liveSocket = socketManagerRef.current;
        if (liveSocket && (liveSocket.connected || liveSocket.client?.connected) && editorRef.current) {
          const currentCode = editorRef.current.getValue();
          liveSocket.sendCodeEdit({
            clientId: clientIdRef.current,
            ...(validUserId ? { userId: validUserId } : {}),
            revision: currentRevision.current,
            fullContent: currentCode
          });
        }
      }, 1500);
    });
    listenerDisposablesRef.current.push(contentDisp);
  };

  // Clean up listeners and timers on component unmount
  useEffect(() => {
    return () => {
      if (fullSyncTimerRef.current) {
        clearTimeout(fullSyncTimerRef.current);
      }
      listenerDisposablesRef.current.forEach((d) => {
        try { d.dispose(); } catch (e) {}
      });
      listenerDisposablesRef.current = [];
    };
  }, []);

  // Handle Monaco Editor Mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Apply initialContent if provided
    if (initialContent) {
      isRemoteChange.current = true;
      editor.setValue(initialContent);
      isRemoteChange.current = false;
      setInitialLoading(false);
    }

    // Refresh with latest from backend
    loadInitialCode();

    // Register active listeners
    setupEditorListeners(editor);
  };

  // Subscribe to real-time code edits & remote cursors via WebSocket
  useEffect(() => {
    if (!socketManager) return;

    // 1. Subscribe to OT Code Edits on /topic/room/{id}/code
    const handleRemoteCode = (msg) => {
      if (!editorRef.current || !monacoRef.current || !msg) return;

      // Skip echo from this client instance (100% reliable across tabs & accounts)
      if (msg.clientId && msg.clientId === clientIdRef.current) {
        if (typeof msg.revision === 'number') {
          currentRevision.current = msg.revision;
        }
        return;
      }

      // Skip echo if sender matches current user and clientId is absent
      const senderUserId = msg.userId || msg.senderId;
      const currentUserId = userRef.current?.id;
      if (!msg.clientId && senderUserId && currentUserId && String(senderUserId) === String(currentUserId)) {
        if (typeof msg.revision === 'number') {
          currentRevision.current = msg.revision;
        }
        return;
      }

      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const model = editor.getModel();
      if (!model) return;

      // Update current revision
      if (typeof msg.revision === 'number') {
        currentRevision.current = msg.revision;
      }

      // Capture local cursor position before applying edit
      const currentPosition = editor.getPosition();

      isRemoteChange.current = true;
      try {
        let rangeToApply = null;
        let textToApply = msg.text || '';

        if (typeof msg.position === 'number') {
          const startPos = model.getPositionAt(msg.position);
          const length = msg.length || 0;
          const endPos = length > 0 ? model.getPositionAt(msg.position + length) : startPos;
          rangeToApply = new monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          );
        } else if (msg.range) {
          rangeToApply = new monaco.Range(
            msg.range.startLineNumber,
            msg.range.startColumn,
            msg.range.endLineNumber,
            msg.range.endColumn
          );
        }

        if (rangeToApply && msg.type) {
          if (msg.type === 'DELETE') {
            textToApply = '';
          }

          editor.executeEdits('ot-remote', [
            {
              range: rangeToApply,
              text: textToApply,
              forceMoveMarkers: false
            }
          ]);

          // Stable caret adjustment for concurrent typing on the same line or below
          if (currentPosition) {
            let newLn = currentPosition.lineNumber;
            let newCol = currentPosition.column;

            const isSameLine = rangeToApply.startLineNumber === currentPosition.lineNumber;
            if (isSameLine) {
              if (rangeToApply.startColumn <= currentPosition.column) {
                const textLen = textToApply ? textToApply.length : 0;
                const replacedLen = rangeToApply.endColumn - rangeToApply.startColumn;
                const delta = textLen - replacedLen;
                newCol = Math.max(rangeToApply.startColumn, currentPosition.column + delta);
              }
            } else if (rangeToApply.startLineNumber < currentPosition.lineNumber) {
              const addedLines = textToApply ? textToApply.split('\n').length - 1 : 0;
              const removedLines = rangeToApply.endLineNumber - rangeToApply.startLineNumber;
              const lineDelta = addedLines - removedLines;
              newLn = Math.max(1, currentPosition.lineNumber + lineDelta);
            }

            editor.setPosition({ lineNumber: newLn, column: newCol });
          }
        }

        // Reconcile with msg.fullContent if provided and content diverged from server truth
        if (msg.fullContent != null && editor.getValue() !== msg.fullContent) {
          const posBeforeSync = editor.getPosition();
          editor.setValue(msg.fullContent);
          if (posBeforeSync) {
            editor.setPosition(posBeforeSync);
          }
        }
      } catch (err) {
        console.error('[DevCollab] Error applying remote OT edit:', err);
        if (msg.fullContent != null && editor.getValue() !== msg.fullContent) {
          const pos = editor.getPosition();
          editor.setValue(msg.fullContent);
          if (pos) editor.setPosition(pos);
        }
      } finally {
        isRemoteChange.current = false;
      }
    };

    const unsubscribeCode = socketManager.subscribe('code', handleRemoteCode);

    // 2. Subscribe to Remote Cursors
    const unsubscribeCursor = socketManager.subscribe('cursor', (cursorMsg) => {
      if (!editorRef.current || !monacoRef.current || !cursorMsg) return;

      const remoteUserId = cursorMsg.userId;
      const currentUserId = userRef.current?.id;
      if (remoteUserId && currentUserId && String(remoteUserId) === String(currentUserId)) return;

      const editor = editorRef.current;
      const monaco = monacoRef.current;

      const userIdKey = remoteUserId || 'anonymous-peer';
      const line = cursorMsg.lineNumber || 1;
      const col = cursorMsg.column || cursorMsg.columnNumber || 1;
      const userName = cursorMsg.displayName || cursorMsg.userName || cursorMsg.username || 'Peer';
      const color = cursorMsg.color || '#a855f7';

      // Dynamically add peer cursor CSS rule for this user color if not present
      const styleId = `peer-cursor-style-${userIdKey}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          .peer-cursor-${userIdKey} {
            border-left: 2px solid ${color} !important;
            position: relative;
            z-index: 10;
          }
          .peer-cursor-${userIdKey}::before {
            content: '${userName.replace(/'/g, "\\'")}';
            position: absolute;
            top: -18px;
            left: -2px;
            font-size: 10px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            background-color: ${color};
            color: #ffffff;
            white-space: nowrap;
            pointer-events: none;
            z-index: 20;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          }
        `;
        document.head.appendChild(style);
      }

      const oldDecorations = peerDecorationsRef.current.get(userIdKey) || [];

      const newDecorations = editor.deltaDecorations(oldDecorations, [
        {
          range: new monaco.Range(line, col, line, col),
          options: {
            className: `peer-cursor-${userIdKey}`,
            hoverMessage: { value: `**${userName}** is editing here` }
          }
        }
      ]);

      peerDecorationsRef.current.set(userIdKey, newDecorations);
    });

    return () => {
      if (unsubscribeCode) unsubscribeCode();
      if (unsubscribeCursor) unsubscribeCursor();
    };
  }, [socketManager]);

  const monacoLanguage = LANGUAGE_MAP[language] || 'javascript';

  return (
    <div className="relative h-full w-full bg-[#1e1e1e]">
      {initialLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-purple-500 border-t-transparent"></div>
            <span className="text-xs text-gray-400">Loading code workspace...</span>
          </div>
        </div>
      )}

      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        theme="vs-dark"
        options={{
          fontSize,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          tabSize: 2,
          wordWrap: 'on'
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};

export default RoomEditor;
