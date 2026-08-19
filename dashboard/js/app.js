// Points at the backend running locally. Once it's hosted (e.g. on Azure),
// change this to that server's URL.
const API_BASE_URL = "http://localhost:4000";

async function fetchJson(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json();
}

function renderStats({ leads, events, sessions }) {
  document.getElementById("stat-leads").textContent = leads;
  document.getElementById("stat-events").textContent = events;
  document.getElementById("stat-sessions").textContent = sessions;
}

function renderLeads(leads) {
  const tbody = document.querySelector("#leads-table tbody");
  tbody.innerHTML = "";

  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">No leads yet.</td></tr>`;
    return;
  }

  for (const lead of leads) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${lead.email}</td>
      <td>${lead.hotspotId || "—"}</td>
      <td>${new Date(lead.createdAt).toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  }
}

function showError(message) {
  const main = document.querySelector(".content");
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  main.prepend(banner);
}

async function loadDashboard() {
  try {
    const [summary, leadsRes] = await Promise.all([
      fetchJson("/api/analytics/summary"),
      fetchJson("/api/leads"),
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

loadDashboard();
