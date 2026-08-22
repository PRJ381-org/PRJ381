/**
 * Main Dashboard Application Entry Point.
 *
 * Coordinates authentication state, analytics data loading, chart rendering, and exports.
 */
import { fetchJson, API_BASE_URL } from './api.js';
import { isAuthenticated, isAdmin, getCurrentUser } from './auth.js';
import { renderEventTypeChart, renderAreaChart, renderHotspotChart, renderTimelineChart } from './charts.js';
import { downloadLeadsCsv, downloadAnalyticsCsv } from './export.js';

function setConnectionStatus(isOnline) {
  const dot = document.querySelector('.status-dot');
  const text = document.getElementById('connection-status');
  if (!dot || !text) return;

  if (isOnline) {
    dot.classList.remove('offline');
    text.textContent = 'Live';
  } else {
    dot.classList.add('offline');
    text.textContent = 'Offline';
  }
}

function renderStats({ leads = 0, events = 0, sessions = 0 }) {
  const statLeads = document.getElementById('stat-leads');
  const statEvents = document.getElementById('stat-events');
  const statSessions = document.getElementById('stat-sessions');
  const statConversion = document.getElementById('stat-conversion');

  if (statLeads) statLeads.textContent = Number(leads).toLocaleString();
  if (statEvents) statEvents.textContent = Number(events).toLocaleString();
  if (statSessions) statSessions.textContent = Number(sessions).toLocaleString();

  if (statConversion) {
    const conversionRate = sessions > 0 ? ((leads / sessions) * 100).toFixed(1) : '0.0';
    statConversion.textContent = `${conversionRate}%`;
  }
}

function renderLeads(leads) {
  const tbody = document.querySelector('#leads-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">No leads yet.</td></tr>`;
    return;
  }

  for (const lead of leads) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${lead.email}</td>
      <td>${lead.hotspotId || '—'}</td>
      <td>${new Date(lead.createdAt).toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  }
}

function renderUsers(users) {
  const tbody = document.querySelector('#users-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No registered users found.</td></tr>`;
    return;
  }

  for (const user of users) {
    const row = document.createElement('tr');
    const roleBadgeClass = user.role === 'admin' ? 'role-admin' : 'role-viewer';
    row.innerHTML = `
      <td><strong>${user.name || 'Campus Member'}</strong></td>
      <td>${user.email}</td>
      <td><span class="role-badge ${roleBadgeClass}">${user.role || 'viewer'}</span></td>
      <td>${new Date(user.createdAt).toLocaleDateString()}</td>
    `;
    tbody.appendChild(row);
  }
}

function showError(message) {
  const main = document.querySelector('.content');
  if (!main) return;

  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = message;
  main.prepend(banner);
}

async function loadDashboard() {
  const existingError = document.querySelector('.error-banner');
  if (existingError) existingError.remove();

  try {
    const [summary, leadsRes, usersRes] = await Promise.all([
      fetchJson('/api/analytics/summary'),
      fetchJson('/api/leads'),
      fetchJson('/api/auth/users').catch(() => ({ users: [] })),
    ]);

    setConnectionStatus(true);
    renderStats({
      leads: leadsRes.count,
      events: summary.totalEvents,
      sessions: summary.uniqueSessions,
    });
    renderEventTypeChart('events-chart', summary.eventsByType);
    renderAreaChart('area-chart', summary.areas);
    renderHotspotChart('hotspot-chart', summary.hotspots);
    renderLeads(leadsRes.leads);
    renderUsers(usersRes.users);
  } catch (err) {
    setConnectionStatus(false);
    showError(
      `Could not load data from backend (${err.message}). Is it running at ${API_BASE_URL}?`
    );
  }
}

// Wire up Refresh Button
const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    btnRefresh.style.opacity = '0.6';
    loadDashboard().finally(() => {
      setTimeout(() => (btnRefresh.style.opacity = '1'), 300);
    });
  });
}

// Initial bootstrap
loadDashboard();
