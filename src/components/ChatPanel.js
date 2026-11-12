import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FiSend, FiMessageSquare } from 'react-icons/fi';

const isValidUuid = (val) =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const ChatPanel = ({ roomId, socketManager }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const history = await chatApi.getMessages(roomId);
      if (Array.isArray(history)) {
        setMessages(history);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!socketManager) return;

    const handleIncomingMessage = (newMsg) => {
      if (!newMsg) return;
      setMessages((prev) => {
        // De-duplicate if message with this id already exists
        if (newMsg.id && prev.some((m) => String(m.id) === String(newMsg.id))) {
          return prev;
        }

        // If there was a pending optimistic message matching this content, replace it
        const currentUserId = user?.id;
        const currentUsername = user?.username;
        const currentEmail = user?.email;
        const msgSenderId = newMsg.senderId || newMsg.userId;
        const msgSenderName = newMsg.senderName || newMsg.sender || newMsg.username;

        const isMe = (currentUserId && msgSenderId && String(msgSenderId) === String(currentUserId)) ||
                     (currentUsername && msgSenderName === currentUsername) ||
                     (currentEmail && msgSenderName === currentEmail);

        if (isMe) {
          const pendingIdx = prev.findIndex((m) => m.pending && m.content === newMsg.content);
          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = newMsg;
            return updated;
          }
        }

        return [...prev, newMsg];
      });
    };

    // Subscribe to both 'chat' and 'chat.send' topics for full backend compatibility
    const unsubChat = socketManager.subscribe('chat', handleIncomingMessage);
    const unsubChatSend = socketManager.subscribe('chat.send', handleIncomingMessage);

    return () => {
      if (unsubChat) unsubChat();
      if (unsubChatSend) unsubChatSend();
    };
  }, [socketManager, user?.id, user?.username, user?.email]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const isConnected = socketManager && (socketManager.connected || socketManager.client?.connected);
    if (!isConnected) {
      alert('Chat is currently connecting to the room. Please wait a moment and try again.');
      return;
    }

    // Optimistic message update for instant UI feedback
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const validUserId = isValidUuid(user?.id) ? user.id : undefined;
    const optimisticMsg = {
      id: tempId,
      content: trimmed,
      type: 'CHAT',
      senderId: validUserId,
      senderName: user?.username || user?.email || user?.displayName || 'Me',
      displayName: user?.displayName || user?.username || user?.email || 'Me',
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      pending: true
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');

    socketManager.sendChatMessage(trimmed, 'CHAT', {
      senderId: validUserId,
      senderName: user?.username || user?.email,
      username: user?.username || user?.email,
      displayName: user?.displayName || user?.username || 'Collaborator'
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-gray-800/80 text-white">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-800/80 px-4 bg-slate-950">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          <FiMessageSquare className="text-purple-400 text-sm" />
          <span>Room Chat</span>
        </div>
        <span className="text-[11px] text-gray-500">
          {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
            <FiMessageSquare className="text-3xl mb-2 opacity-50" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[11px] text-gray-600 mt-0.5">Say hello to your collaborators!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const senderDisplayName = msg.displayName || msg.senderName || msg.sender || msg.username || 'Collaborator';
            const msgSenderId = msg.senderId || msg.userId;
            const msgSenderName = msg.senderName || msg.sender || msg.username;

            const isMe = (user?.id && msgSenderId && String(msgSenderId) === String(user.id)) ||
                         (user?.username && msgSenderName === user.username) ||
                         (user?.displayName && msgSenderName === user.displayName) ||
                         (user?.email && msgSenderName === user.email);
            const isSystem = msg.type === 'JOIN' || msg.type === 'LEAVE';

            if (isSystem) {
              return (
                <div key={msg.id || index} className="text-center my-2">
                  <span className="rounded-full bg-slate-800/60 px-2.5 py-0.5 text-[10px] text-gray-400">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const senderInitial = senderDisplayName.charAt(0).toUpperCase();
            const timeRaw = msg.createdAt || msg.timestamp;
            const timeStr = timeRaw
              ? new Date(timeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={msg.id || index}
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!isMe && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-700 text-xs font-bold text-white shadow">
                    {senderInitial}
                  </div>
                )}

                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <span className="mb-1 text-[10px] font-semibold text-gray-400">
                      {senderDisplayName}
                    </span>
                  )}

                  <div
                    className={`rounded-2xl px-3 py-2 text-xs leading-relaxed break-words ${
                      isMe
                        ? 'bg-purple-700 text-white rounded-br-none shadow-md shadow-purple-950/40'
                        : 'bg-slate-800 text-gray-200 rounded-bl-none border border-gray-700/60'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    {timeStr && (
                      <span className="text-[9px] text-gray-500">
                        {timeStr}
                      </span>
                    )}
                    {msg.pending && (
                      <span className="text-[9px] text-purple-400 animate-pulse">
                        sending...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800/80 bg-slate-950">
        <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-slate-900 px-3 py-1.5 focus-within:border-purple-500">
          <input
            type="text"
            placeholder={
              socketManager && (socketManager.connected || socketManager.client?.connected)
                ? 'Type a message...'
                : 'Connecting to chat...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="rounded-lg bg-purple-700 p-1.5 text-white transition hover:bg-purple-600 disabled:opacity-40"
          >
            <FiSend className="text-xs" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
