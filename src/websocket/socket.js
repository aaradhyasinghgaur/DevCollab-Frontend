import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuthToken, API_BASE_URL } from '../api/client';

const WS_URL = process.env.REACT_APP_WS_URL || `${API_BASE_URL.replace(/\/$/, '')}/ws`;

export class RoomSocketManager {
  constructor(roomId, onConnectCallback, userInfo = null) {
    this.roomId = roomId;
    this.userInfo = userInfo;
    this.client = null;
    this.subscriptions = new Map();
    this.onConnectCallback = onConnectCallback;
    this.connected = false;
  }

  setUserInfo(userInfo) {
    this.userInfo = userInfo;
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

  subscribe(topic, callback) {
    if (!this.client) return null;

    const fullTopic = `/topic/room/${this.roomId}/${topic}`;

    const doSubscribe = () => {
      if (!this.client || !this.client.connected) return null;
      const sub = this.client.subscribe(fullTopic, (message) => {
        try {
          const payload = JSON.parse(message.body);
          callback(payload);
        } catch (e) {
          callback(message.body);
        }
      });
      return sub;
    };

    if (this.connected) {
      const sub = doSubscribe();
      this.subscriptions.set(topic, sub);
      return () => {
        if (sub) sub.unsubscribe();
        this.subscriptions.delete(topic);
      };
    } else {
      // Defer until connected
      const checkInterval = setInterval(() => {
        if (this.connected) {
          clearInterval(checkInterval);
          const sub = doSubscribe();
          this.subscriptions.set(topic, sub);
        }
      }, 200);

      return () => {
        clearInterval(checkInterval);
        const sub = this.subscriptions.get(topic);
        if (sub) {
          sub.unsubscribe();
          this.subscriptions.delete(topic);
        }
      };
    }
  }

  send(destination, body) {
    if (this.client && this.connected) {
      this.client.publish({
        destination: `/app/room/${this.roomId}/${destination}`,
        body: JSON.stringify(body)
      });
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
      userId: this.userInfo?.id || extra.userId,
      username: this.userInfo?.username || extra.username,
      displayName: this.userInfo?.displayName || extra.displayName,
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
