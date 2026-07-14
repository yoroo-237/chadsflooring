// Strip any trailing /api from env var before appending, so both
// "https://api.example.com" and "https://api.example.com/api" work.
const _apiRoot = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');
const API_BASE = `${_apiRoot}/api`;

export { API_BASE };

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const json = await res.json();
  // unwrap { success, data: { token } } envelope
  const payload = json.success === true && 'data' in json ? json.data : json;
  const token = payload.token || payload.accessToken;
  if (token) setToken(token);
  return token;
}

export async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Only attempt refresh + redirect if the user actually had a token.
    // Without this guard, public-page API calls that return 401 would
    // incorrectly kick unauthenticated users to /login.
    const hadToken = !!getToken();
    if (hadToken) {
      try {
        await refreshAccessToken();
        return apiCall(endpoint, options);
      } catch {
        logout();
        throw new Error('Session expired');
      }
    }
    throw new Error('Authentication required');
  }

  const json = await res.json();
  // Throw on explicit API errors so callers don't silently treat error responses as success.
  if (json.success === false) {
    const err = new Error(json.error || 'Request failed');
    if (json.errors) err.errors = json.errors;
    throw err;
  }
  // Auto-unwrap the { success: true, data: {...} } envelope used by every backend route.
  return json.success === true && 'data' in json ? json.data : json;
}

export const api = {
  get: (endpoint, params) => {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return apiCall(url);
  },
  post: (endpoint, body) => apiCall(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => apiCall(endpoint, { method: 'PUT', body }),
  patch: (endpoint, body) => apiCall(endpoint, { method: 'PATCH', body }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
};
