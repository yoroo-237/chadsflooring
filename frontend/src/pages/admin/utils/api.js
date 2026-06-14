const API_BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export async function adminFetch(endpoint, options = {}) {
  const { method = 'GET', body, isFormData = false } = options;
  const token = getToken();

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  const json = await res.json();
  if (!json.success) {
    const err = new Error(json.error || 'API Error');
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export { API_BASE };
