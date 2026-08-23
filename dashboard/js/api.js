/**
 * Centralized API client module.
 */

// Dynamically resolves local backend or hosted server
export const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : window.location.origin;

/**
 * Fetch wrapper that attaches auth token if present.
 */
export async function fetchJson(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `${path} returned status ${res.status}`);
  }

  return res.json();
}
