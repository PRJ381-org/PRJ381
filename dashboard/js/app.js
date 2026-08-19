// Placeholder data for now — swap for real fetch() calls to the backend
// (see backend/src/routes) once the API is ready to serve dashboard reads.
const sampleStats = {
  leads: 12,
  events: 348,
  sessions: 27,
};

const sampleLeads = [
  { email: "prospective.student@example.com", hotspotId: "library", createdAt: "2026-08-18T10:15:00Z" },
  { email: "another.student@example.com", hotspotId: "sports-field", createdAt: "2026-08-17T14:42:00Z" },
];

function renderStats(stats) {
  document.getElementById("stat-leads").textContent = stats.leads;
  document.getElementById("stat-events").textContent = stats.events;
  document.getElementById("stat-sessions").textContent = stats.sessions;
}

function renderLeads(leads) {
  const tbody = document.querySelector("#leads-table tbody");
  tbody.innerHTML = "";
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

renderStats(sampleStats);
renderLeads(sampleLeads);
