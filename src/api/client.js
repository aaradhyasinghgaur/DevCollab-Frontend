const rawApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Ensure protocol is present so browsers never treat it as a relative path
const normalizeUrl = (url) => {
  if (!url) return 'http://localhost:8080';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
};

export const API_BASE_URL = normalizeUrl(rawApiUrl);

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && (data.message || data.error)) || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  login: (credentials) => request('/api/v1/auth/authenticate', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  register: (userData) => request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),
  getMe: () => request('/api/v1/users/me', {
    method: 'GET'
  })
};

export const roomApi = {
  getAll: () => request('/api/rooms', {
    method: 'GET'
  }),
  getById: (id) => request(`/api/rooms/${id}`, {
    method: 'GET'
  }),
  getByCode: (code) => request(`/api/rooms/code/${code}`, {
    method: 'GET'
  }),
  create: (roomData) => request('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(roomData)
  }),
  join: (inviteCode) => request('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode })
  }),
  leave: (roomId) => request(`/api/rooms/${roomId}/leave`, {
    method: 'POST'
  }),
  update: (roomId, roomData) => request(`/api/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(roomData)
  }),
  delete: (roomId) => request(`/api/rooms/${roomId}`, {
    method: 'DELETE'
  }),
  kickParticipant: (roomId, userId) => request(`/api/rooms/${roomId}/participants/${userId}`, {
    method: 'DELETE'
  })
};

export const codeApi = {
  getCode: (roomId) => request(`/api/rooms/${roomId}/code`, {
    method: 'GET'
  })
};

export const chatApi = {
  getMessages: (roomId) => request(`/api/rooms/${roomId}/chat`, {
    method: 'GET'
  })
};

export const executionApi = {
  execute: (roomId, payload) => request(`/api/rooms/${roomId}/execute`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};

const apiClient = {
  auth: authApi,
  room: roomApi,
  code: codeApi,
  chat: chatApi,
  execution: executionApi
};

export default apiClient;

