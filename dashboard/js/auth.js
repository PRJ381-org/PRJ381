/**
 * Authentication and Role State Management Module.
 */
import { fetchJson } from './api.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!sessionStorage.getItem('token');
}

export function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

/**
 * Logs in with email/password and saves session token.
 */
export async function login(email, password) {
  const data = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.token) {
    sessionStorage.setItem('token', data.token);
    currentUser = data.user;
  }
  return data;
}

/**
 * Clears current session and logs out.
 */
export function logout() {
  sessionStorage.removeItem('token');
  currentUser = null;
  window.location.reload();
}
