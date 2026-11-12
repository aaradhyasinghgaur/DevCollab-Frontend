import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuthToken, API_BASE_URL } from '../api/client';

const isValidUuid = (val) =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export const getWsUrl = () => {
  const rawWs = process.env.REACT_APP_WS_URL;
  if (rawWs && rawWs.trim()) {
    let cleaned = rawWs.trim().replace(/\/+$/, '');
    // Ensure absolute protocol scheme is always present so browsers never resolve it as a relative URL
    if (/^wss:\/\//i.test(cleaned)) {
      cleaned = cleaned.replace(/^wss:\/\//i, 'https://');
    } else if (/^ws:\/\//i.test(cleaned)) {
      cleaned = cleaned.replace(/^ws:\/\//i, 'http://');
    } else if (!/^https?:\/\//i.test(cleaned)) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      cleaned = `${isHttps ? 'https' : 'http'}://${cleaned}`;
    }
    if (!/\/ws$/i.test(cleaned)) {
      cleaned = `${cleaned}/ws`;
    }
    return cleaned;
  }

  let base = API_BASE_URL.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    base = `${isHttps ? 'https' : 'http'}://${base}`;
  }
  return `${base}/ws`;
};

export const getNativeWsUrl = () => {
  const wsUrl = getWsUrl();
  return wsUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
};

export class RoomSocketManager {
  constructor(roomId, onConnectCallback, userInfo = null, onDisconnectCallback = null) {
    this.roomId = roomId;
    this.userInfo = userInfo;
    this.client = null;
    this.subscriptions = new Map(); // topic -> stompSubscription
    this.subCallbacks = new Map(); // topic -> callback function
    this.outgoingQueue = []; // Queue outgoing messages if sent before socket is connected
    this.onConnectCallback = onConnectCallback;
    this.onDisconnectCallback = onDisconnectCallback;
    this.connected = false;
    this.fallbackToSockJs = false;
  }

  setUserInfo(userInfo) {
    this.userInfo = userInfo;
    if (this.connected && this.userInfo) {
      this.sendPresence('ACTIVE');
    }
  }

  connect() {
    const token = getAuthToken();
    const wsUrl = getWsUrl();
    const nativeWsUrl = getNativeWsUrl();

    console.log('[DevCollab] Attempting connection. Native WS:', nativeWsUrl, '| SockJS URL:', wsUrl);

    const initClient = () => {
      const config = {
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        debug: (msg) => {
          console.log('[DevCollab STOMP]', msg);
        },
        reconnectDelay: 3000,
        heartbeatIncoming: 0,
        heartbeatOutgoing: 0,
        onConnect: (frame) => {
          this.connected = true;
          console.log('[DevCollab] Connected successfully via', this.fallbackToSockJs ? 'SockJS' : 'Native WebSocket');
          if (this.onConnectCallback) {
            try {
              this.onConnectCallback(frame);
            } catch (e) {
              console.error('[DevCollab] onConnectCallback error:', e);
            }
          }

          // Resubscribe all registered topics upon connection or reconnection
          this.subCallbacks.forEach((cb, topic) => {
            this._createStompSubscription(topic, cb);
          });

          // Flush any messages that were queued while connecting
          this._flushOutgoingQueue();

          // Send initial presence ping
          this.sendPresence('ACTIVE');
        },
        onDisconnect: (frame) => {
          this.connected = false;
          if (this.onDisconnectCallback) {
            try {
              this.onDisconnectCallback(frame);
            } catch (e) {}
          }
        },
        onWebSocketClose: (event) => {
          this.connected = false;
          if (this.onDisconnectCallback) {
            try {
              this.onDisconnectCallback();
            } catch (e) {}
          }

          // Automatic fallback to SockJS if native WebSocket fails or is blocked by network
          if (!this.fallbackToSockJs && event && event.code !== 1000) {
            console.warn('[DevCollab] Native WebSocket closed unexpectedly, switching transport to SockJS...');
            this.fallbackToSockJs = true;
            setTimeout(() => {
              if (this.client) {
                try { this.client.deactivate(); } catch (e) {}
                this.client = initClient();
                this.client.activate();
              }
            }, 600);
          }
        },
        onStompError: (frame) => {
          console.error('[DevCollab STOMP error]:', frame.headers ? frame.headers['message'] : frame, frame.body);
        },
        onWebSocketError: (event) => {
          console.error('[DevCollab WebSocket error]:', event);
        }
      };

      if (this.fallbackToSockJs) {
        config.webSocketFactory = () => new SockJS(wsUrl);
      } else {
        // Native WebSocket is primary: fastest, avoids SockJS 405 / CORS issues on Railway
        config.brokerURL = nativeWsUrl;
      }

      return new Client(config);
    };

    this.client = initClient();
    this.client.activate();
  }

  _flushOutgoingQueue() {
    if (!this.outgoingQueue || this.outgoingQueue.length === 0) return;
    const queued = [...this.outgoingQueue];
    this.outgoingQueue = [];
    console.log(`[DevCollab] Flushing ${queued.length} queued messages after connect`);
    queued.forEach(({ destination, body }) => {
      this.send(destination, body);
    });
  }

  _createStompSubscription(topic, callback) {
    if (!this.client || !this.client.connected) return null;
    const fullTopic = topic.startsWith('/') ? topic : `/topic/room/${this.roomId}/${topic}`;
    try {
      const existing = this.subscriptions.get(topic);
      if (existing) {
        try { existing.unsubscribe(); } catch (e) {}
      }
      const sub = this.client.subscribe(fullTopic, (message) => {
        try {
          const payload = JSON.parse(message.body);
          callback(payload);
        } catch (e) {
          callback(message.body);
        }
      });
      this.subscriptions.set(topic, sub);
      return sub;
    } catch (err) {
      console.warn(`[DevCollab] Failed to subscribe to ${fullTopic}:`, err);
      return null;
    }
  }

  subscribe(topic, callback) {
    this.subCallbacks.set(topic, callback);

    if (this.client && this.client.connected) {
      this._createStompSubscription(topic, callback);
    }

    return () => {
      this.subCallbacks.delete(topic);
      const sub = this.subscriptions.get(topic);
      if (sub) {
        try { sub.unsubscribe(); } catch (e) {}
        this.subscriptions.delete(topic);
      }
    };
  }

  send(destination, body) {
    const isSocketReady = this.client && (this.connected || this.client.connected);
    if (isSocketReady) {
      try {
        const dest = destination.startsWith('/') ? destination : `/app/room/${this.roomId}/${destination}`;
        this.client.publish({
          destination: dest,
          body: JSON.stringify(body)
        });
      } catch (err) {
        console.error(`[DevCollab] Failed to publish to ${destination}:`, err);
      }
    } else {
      // Buffer messages sent while socket is connecting/reconnecting
      if (this.outgoingQueue.length < 200) {
        this.outgoingQueue.push({ destination, body });
      }
    }
  }

  sendChatMessage(content, type = 'CHAT', extra = {}) {
    const sender = this.userInfo?.username || this.userInfo?.email || extra.senderName || extra.username || 'anonymous';
    const validUserId = (this.userInfo?.id && isValidUuid(this.userInfo.id))
      ? this.userInfo.id
      : (isValidUuid(extra.senderId) ? extra.senderId : undefined);

    // Strictly match Jackson ChatMessageDto fields to avoid UnrecognizedPropertyException on backend
    const payload = {
      content: content ? content.trim() : '',
      type,
      senderName: sender,
      ...(validUserId ? { senderId: validUserId } : {})
    };

    this.send('chat.send', payload);
  }

  sendCursor(lineNumber, columnNumber, clientId = null) {
    const validUserId = (this.userInfo?.id && isValidUuid(this.userInfo.id)) ? this.userInfo.id : undefined;

    this.send('cursor', {
      lineNumber: lineNumber || 1,
      column: columnNumber || 1,
      columnNumber: columnNumber || 1,
      ...(clientId ? { clientId } : {}),
      username: this.userInfo?.username,
      displayName: this.userInfo?.displayName || this.userInfo?.username || 'Peer',
      ...(validUserId ? { userId: validUserId } : {})
    });
  }

  sendPresence(status = 'ACTIVE', extra = {}) {
    const validUserId = (this.userInfo?.id && isValidUuid(this.userInfo.id))
      ? this.userInfo.id
      : (isValidUuid(extra.userId) ? extra.userId : undefined);

    const username = this.userInfo?.username || this.userInfo?.email || extra.username;
    const displayName = this.userInfo?.displayName || this.userInfo?.username || extra.displayName || 'Collaborator';

    this.send('presence', {
      status,
      type: status,
      timestamp: Date.now(),
      username: username || 'anonymous',
      displayName: displayName,
      ...(validUserId ? { userId: validUserId } : {})
    });
  }

  leave() {
    if (this.client && (this.connected || this.client.connected)) {
      try {
        const validUserId = (this.userInfo?.id && isValidUuid(this.userInfo.id)) ? this.userInfo.id : undefined;
        const username = this.userInfo?.username || this.userInfo?.email;
        const displayName = this.userInfo?.displayName || this.userInfo?.username || 'Collaborator';

        this.send('presence', {
          status: 'LEAVE',
          type: 'LEAVE',
          timestamp: Date.now(),
          username: username || 'anonymous',
          displayName: displayName,
          ...(validUserId ? { userId: validUserId } : {})
        });
      } catch (e) {}
    }
    this.disconnect();
  }

  sendCodeEdit(operation) {
    this.send('code.edit', operation);
  }

  disconnect() {
    this.outgoingQueue = [];
    this.subscriptions.forEach((sub) => {
      try {
        if (sub) sub.unsubscribe();
      } catch (e) {}
    });
    this.subscriptions.clear();

    if (this.client) {
      try {
        this.client.deactivate();
      } catch (e) {}
      this.client = null;
    }
    this.connected = false;
  }
}

export default RoomSocketManager;
