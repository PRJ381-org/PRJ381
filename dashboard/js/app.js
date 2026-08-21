/**
 * Main Dashboard Application Entry Point.
 *
 * Coordinates authentication state, analytics data loading, chart rendering, and exports.
 */
import { fetchJson, API_BASE_URL } from './api.js';
import { isAuthenticated, isAdmin, getCurrentUser } from './auth.js';
import { renderAreaChart, renderHotspotChart, renderTimelineChart } from './charts.js';
import { downloadLeadsCsv, downloadAnalyticsCsv } from './export.js';

function renderStats({ leads, events, sessions }) {
  const statLeads = document.getElementById('stat-leads');
  const statEvents = document.getElementById('stat-events');
  const statSessions = document.getElementById('stat-sessions');

  if (statLeads) statLeads.textContent = leads;
  if (statEvents) statEvents.textContent = events;
  if (statSessions) statSessions.textContent = sessions;
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

function showError(message) {
  const main = document.querySelector('.content');
  if (!main) return;

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = message;
  main.prepend(banner);
}

async function loadDashboard() {
  try {
    const [summary, leadsRes] = await Promise.all([
      fetchJson('/api/analytics/summary'),
      fetchJson('/api/leads'),
    ]);

    renderStats({
      leads: leadsRes.count,
      events: summary.totalEvents,
      sessions: summary.uniqueSessions,
    });
    renderLeads(leadsRes.leads);
  } catch (err) {
    showError(
      `Could not load data from the backend (${err.message}). Is it running at ${API_BASE_URL}?`
    );
  }
}

// Initial bootstrap
loadDashboard();
