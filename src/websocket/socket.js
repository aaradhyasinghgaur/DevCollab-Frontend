import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuthToken, API_BASE_URL } from '../api/client';

const getWsUrl = () => {
  const rawWs = process.env.REACT_APP_WS_URL;
  if (rawWs && rawWs.trim()) {
    // SockJS requires http/https URL scheme, convert ws/wss if provided
    return rawWs.trim().replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
  }
  return `${API_BASE_URL.replace(/\/+$/, '')}/ws`;
};

const WS_URL = getWsUrl();

export class RoomSocketManager {
  constructor(roomId, onConnectCallback, userInfo = null) {
    this.roomId = roomId;
    this.userInfo = userInfo;
    this.client = null;
    this.subscriptions = new Map(); // topic -> stompSubscription
    this.subCallbacks = new Map(); // topic -> callback function
    this.onConnectCallback = onConnectCallback;
    this.connected = false;
  }

  setUserInfo(userInfo) {
    this.userInfo = userInfo;
    if (this.connected && this.userInfo) {
      this.sendPresence('ACTIVE');
    }
  }

  connect() {
    const token = getAuthToken();

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      debug: () => {}, // Disable noisy logs in production
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => {
        this.connected = true;
        if (this.onConnectCallback) {
          this.onConnectCallback(frame);
        }

        // Resubscribe any registered topics upon connection or reconnection
        this.subCallbacks.forEach((cb, topic) => {
          this._createStompSubscription(topic, cb);
        });

        // Send initial presence ping
        this.sendPresence('ACTIVE');
      },
      onDisconnect: () => {
        this.connected = false;
      },
      onStompError: (frame) => {
        console.error('STOMP protocol error:', frame.headers['message'], frame.body);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket connection error:', event);
      }
    });

    this.client.activate();
  }

  _createStompSubscription(topic, callback) {
    if (!this.client || !this.client.connected) return null;
    const fullTopic = `/topic/room/${this.roomId}/${topic}`;
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
      console.warn(`Failed to subscribe to ${fullTopic}:`, err);
      return null;
    }
  }

  subscribe(topic, callback) {
    this.subCallbacks.set(topic, callback);

    if (this.connected) {
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
    if (this.client && (this.connected || this.client.connected)) {
      try {
        this.client.publish({
          destination: `/app/room/${this.roomId}/${destination}`,
          body: JSON.stringify(body)
        });
      } catch (err) {
        console.error(`Failed to publish to /app/room/${this.roomId}/${destination}:`, err);
      }
    } else {
      console.warn(`DevCollab WebSocket: cannot send to ${destination}, socket not connected`);
    }
  }

  sendChatMessage(content, type = 'CHAT') {
    this.send('chat.send', { content, type });
  }

  sendCursor(lineNumber, columnNumber) {
    this.send('cursor', {
      lineNumber: lineNumber || 1,
      column: columnNumber || 1,
      columnNumber: columnNumber || 1
    });
  }

  sendPresence(status = 'ACTIVE', extra = {}) {
    this.send('presence', {
      status,
      timestamp: Date.now(),
      userId: this.userInfo?.id ? String(this.userInfo.id) : (extra.userId ? String(extra.userId) : undefined),
      username: this.userInfo?.username || extra.username,
      displayName: this.userInfo?.displayName || this.userInfo?.username || extra.displayName,
      ...extra
    });
  }

  leave() {
    if (this.client && this.connected) {
      try {
        this.sendPresence('LEAVE');
      } catch (e) {}
    }
    this.disconnect();
  }

  sendCodeEdit(operation) {
    // operation format: { type: 'INSERT'|'DELETE', position, text, length, revision }
    this.send('code.edit', operation);
  }

  disconnect() {
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
