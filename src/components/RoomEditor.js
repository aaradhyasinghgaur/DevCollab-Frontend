import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { codeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FiEye } from 'react-icons/fi';

const LANGUAGE_MAP = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  JAVA: 'java',
  CPP: 'cpp',
  C: 'c'
};

const isValidUuid = (val) =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Clean Monaco IContentWidget for remote collaborator cursors.
 * Renders a single caret line and floating name badge at exact {lineNumber, column}
 * without polluting document lines or duplicating when lines are inserted.
 */
class RemoteCursorWidget {
  constructor(editor, id, userId, name, color) {
    this.editor = editor;
    this.id = id;
    this.userId = userId;
    this.name = name;
    this.color = color || '#a855f7';
    this.domNode = document.createElement('div');
    this.domNode.className = 'monaco-remote-cursor-container';
    this.domNode.style.cssText = 'pointer-events: none; z-index: 50; position: absolute;';

    this.position = {
      position: { lineNumber: 1, column: 1 },
      preference: [0] // monaco.editor.ContentWidgetPositionPreference.EXACT
    };

    this.render();
    try {
      this.editor.addContentWidget(this);
    } catch (e) {}
  }

  render() {
    const safeName = String(this.name || 'Peer').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.domNode.innerHTML = `
      <div style="position: relative; width: 0; height: 19px;">
        <div style="position: absolute; left: 0; top: 0; width: 2px; height: 100%; background: ${this.color}; border-radius: 1px; box-shadow: 0 0 6px ${this.color}99;"></div>
        <div style="position: absolute; left: -2px; top: -18px; background: ${this.color}; color: #ffffff; font-size: 10px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 1px 6px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5); pointer-events: none; line-height: 1.2;">
          ${safeName}
        </div>
      </div>
    `;
  }

  getId() {
    return 'remote-cursor-' + this.id;
  }

  getDomNode() {
    return this.domNode;
  }

  getPosition() {
    return this.position;
  }

  update(lineNumber, column, newName, newColor) {
    if (newName && newName !== this.name) {
      this.name = newName;
      this.render();
    }
    if (newColor && newColor !== this.color) {
      this.color = newColor;
      this.render();
    }

    const model = this.editor.getModel();
    const maxLine = model ? model.getLineCount() : lineNumber;
    const safeLine = Math.min(Math.max(1, lineNumber), maxLine);
    const maxCol = model ? model.getLineMaxColumn(safeLine) : column;
    const safeCol = Math.min(Math.max(1, column), maxCol);

    this.position = {
      position: { lineNumber: safeLine, column: safeCol },
      preference: [0] // monaco.editor.ContentWidgetPositionPreference.EXACT
    };
    try {
      this.editor.layoutContentWidget(this);
    } catch (e) {}
  }

  destroy() {
    try {
      this.editor.removeContentWidget(this);
    } catch (e) {}
    if (this.domNode && this.domNode.parentNode) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
  }
}

const RoomEditor = ({
  roomId,
  language = 'JAVASCRIPT',
  fontSize = 14,
  readOnly = false,
  participants = [],
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

  // Monaco Content Widgets storage: Map<clientKey, { widget: RemoteCursorWidget, timer: any }>
  const peerWidgetsRef = useRef(new Map());

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

  // Update Monaco options dynamically when access rights / readOnly changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: Boolean(readOnly),
        domReadOnly: Boolean(readOnly)
      });
    }
  }, [readOnly]);

  // Broadcast initial cursor position when socketManager connects
  useEffect(() => {
    if (socketManager && editorRef.current) {
      const pos = editorRef.current.getPosition();
      if (pos && (socketManager.connected || socketManager.client?.connected)) {
        socketManager.sendCursor(pos.lineNumber, pos.column, clientIdRef.current);
      }
    }
  }, [socketManager]);

  // Purge any remote cursor widgets whose owner is offline
  useEffect(() => {
    if (!participants) return;

    const activeUserIds = new Set();
    const activeNames = new Set();

    participants.forEach((p) => {
      const isOnline = p.online === true || p.online === 'true';
      if (isOnline) {
        if (p.userId) activeUserIds.add(String(p.userId));
        const name = p.displayName || p.userName || p.username;
        if (name) activeNames.add(name.toLowerCase());
      }
    });

    peerWidgetsRef.current.forEach((peerData, key) => {
      const { widget } = peerData;
      const wUserId = widget.userId ? String(widget.userId) : null;
      const wName = widget.name ? String(widget.name).toLowerCase() : null;

      // Check if this widget's owner is still active
      const isStillActive = (wUserId && activeUserIds.has(wUserId)) ||
                            (wName && activeNames.has(wName));

      if (!isStillActive) {
        if (peerData.timer) clearTimeout(peerData.timer);
        widget.destroy();
        peerWidgetsRef.current.delete(key);
      }
    });
  }, [participants]);

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
        socket.sendCursor(e.position.lineNumber, e.position.column, clientIdRef.current);
      }
    });
    listenerDisposablesRef.current.push(cursorDisp);

    // Publish initial cursor position upon listener setup
    const initialPos = editor.getPosition();
    if (initialPos) {
      const socket = socketManagerRef.current;
      if (socket && (socket.connected || socket.client?.connected)) {
        socket.sendCursor(initialPos.lineNumber, initialPos.column, clientIdRef.current);
      }
    }

    // 2. Listen to local typing changes and publish deltas
    const contentDisp = editor.onDidChangeModelContent((event) => {
      if (isRemoteChange.current || readOnly) return;

      const socket = socketManagerRef.current;
      if (!socket) return;

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
            revision: currentRevision.current
          });
        }
      });
    });
    listenerDisposablesRef.current.push(contentDisp);
  };

  // Clean up listeners, widgets, and legacy styles on component unmount
  useEffect(() => {
    // Purge any lingering legacy style tags from earlier sessions
    const legacyStyles = document.querySelectorAll('style[id^="peer-cursor-style-"]');
    legacyStyles.forEach((s) => s.remove());
    const peerWidgets = peerWidgetsRef.current;
    const disposables = listenerDisposablesRef.current;
    return () => {
      disposables.forEach((d) => {
        try { d.dispose(); } catch (e) {}
      });
      disposables.length = 0;

      peerWidgets.forEach(({ widget, timer }) => {
        if (timer) clearTimeout(timer);
        if (widget) widget.destroy();
      });
      peerWidgets.clear();
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

  // Subscribe to real-time code edits, remote cursors, and presence via WebSocket
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
              forceMoveMarkers: true
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
        } else if (!msg.type && msg.fullContent != null) {
          // Explicit full-sync message only (when no delta type is set)
          if (editor.getValue() !== msg.fullContent) {
            const posBeforeSync = editor.getPosition();
            editor.setValue(msg.fullContent);
            if (posBeforeSync) {
              editor.setPosition(posBeforeSync);
            }
          }
        }
      } catch (err) {
        console.error('[DevCollab] Error applying remote OT edit:', err);
      } finally {
        isRemoteChange.current = false;
      }
    };

    const unsubscribeCode = socketManager.subscribe('code', handleRemoteCode);

    // 2. Subscribe to Remote Cursors
    const unsubscribeCursor = socketManager.subscribe('cursor', (cursorMsg) => {
      if (!editorRef.current || !cursorMsg) return;

      // Filter out echo from this exact client tab
      if (cursorMsg.clientId && cursorMsg.clientId === clientIdRef.current) {
        return;
      }

      // Filter out any cursor belonging to the current logged-in user
      const currentUser = userRef.current;
      const remoteUserId = cursorMsg.userId;
      const currentUserId = currentUser?.id;
      if (remoteUserId && currentUserId && String(remoteUserId) === String(currentUserId)) {
        return;
      }

      const remoteUsername = (cursorMsg.username || '').toLowerCase().trim();
      const remoteDisplayName = (cursorMsg.displayName || cursorMsg.userName || '').toLowerCase().trim();
      const myUsername = (currentUser?.username || '').toLowerCase().trim();
      const myDisplayName = (currentUser?.displayName || '').toLowerCase().trim();
      const myEmail = (currentUser?.email || '').toLowerCase().trim();

      const isSelfName = (remoteUsername && (remoteUsername === myUsername || remoteUsername === myEmail)) ||
                         (remoteDisplayName && (remoteDisplayName === myDisplayName || remoteDisplayName === myUsername));
      if (isSelfName) {
        return;
      }

      const editor = editorRef.current;
      const clientKey = cursorMsg.clientId || (remoteUserId ? String(remoteUserId) : 'peer-' + (cursorMsg.username || 'anon'));
      const line = Math.max(1, cursorMsg.lineNumber || 1);
      const col = Math.max(1, cursorMsg.column || cursorMsg.columnNumber || 1);
      const userName = cursorMsg.displayName || cursorMsg.userName || cursorMsg.username || 'Collaborator';
      const color = cursorMsg.color || '#a855f7';

      let peerData = peerWidgetsRef.current.get(clientKey);

      if (!peerData) {
        const widget = new RemoteCursorWidget(editor, clientKey, remoteUserId, userName, color);
        peerData = { widget, timer: null };
        peerWidgetsRef.current.set(clientKey, peerData);
      }

      peerData.widget.update(line, col, userName, color);

      // Auto-hide inactive remote cursor after 20 seconds of no movement
      if (peerData.timer) {
        clearTimeout(peerData.timer);
      }
      peerData.timer = setTimeout(() => {
        const existing = peerWidgetsRef.current.get(clientKey);
        if (existing) {
          existing.widget.destroy();
          peerWidgetsRef.current.delete(clientKey);
        }
      }, 20000);
    });

    // 3. Immediately remove cursor widget when user leaves or goes offline
    const unsubscribePresence = socketManager.subscribe('presence', (presenceMsg) => {
      if (!presenceMsg) return;
      const isLeave = presenceMsg.type === 'LEAVE' ||
                      presenceMsg.status === 'LEAVE' ||
                      presenceMsg.type === 'OFFLINE' ||
                      presenceMsg.status === 'OFFLINE' ||
                      presenceMsg.type === 'KICKED' ||
                      presenceMsg.status === 'KICKED' ||
                      presenceMsg.type === 'USER_LEFT' ||
                      presenceMsg.status === 'USER_LEFT';

      if (isLeave) {
        const targetId = presenceMsg.userId ? String(presenceMsg.userId) : null;
        const targetName = (presenceMsg.username || presenceMsg.displayName) ? String(presenceMsg.username || presenceMsg.displayName).toLowerCase() : null;

        peerWidgetsRef.current.forEach((peerData, key) => {
          const wId = peerData.widget?.userId ? String(peerData.widget.userId) : null;
          const wName = peerData.widget?.name ? String(peerData.widget.name).toLowerCase() : null;

          const matchesId = targetId && (wId === targetId || key.includes(targetId));
          const matchesName = targetName && (wName === targetName || key.toLowerCase().includes(targetName));

          if (matchesId || matchesName) {
            if (peerData.timer) clearTimeout(peerData.timer);
            peerData.widget.destroy();
            peerWidgetsRef.current.delete(key);
          }
        });
      }
    });

    return () => {
      if (unsubscribeCode) unsubscribeCode();
      if (unsubscribeCursor) unsubscribeCursor();
      if (unsubscribePresence) unsubscribePresence();
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

      {readOnly && (
        <div className="absolute top-3 right-5 z-20 flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-950/80 px-3 py-1 text-xs font-semibold text-blue-300 shadow-lg backdrop-blur-md">
          <FiEye className="text-sm" />
          <span>View-Only Mode</span>
        </div>
      )}

      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        theme="vs-dark"
        options={{
          fontSize,
          readOnly: Boolean(readOnly),
          domReadOnly: Boolean(readOnly),
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
