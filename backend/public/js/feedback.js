import { fetchJson } from './api.js';

/**
 * Loads and renders Google Form feedback responses into the Feedback page.
 * Safe to call for non-admins too - the backend just returns a 403 and this
 * quietly leaves the "not connected" placeholder in place.
 */
export async function loadFeedback() {
  const status = document.getElementById('feedback-status');
  const table = document.getElementById('feedback-table');
  const head = document.getElementById('feedback-table-head');
  const body = table ? table.querySelector('tbody') : null;
  if (!status || !table || !head || !body) return;

  try {
    const data = await fetchJson('/api/feedback');
    const rows = data.feedback || [];

    if (rows.length === 0) {
      status.textContent = 'No feedback submissions yet.';
      status.style.display = 'block';
      table.style.display = 'none';
      return;
    }

    const columns = Object.keys(rows[0]);
    head.innerHTML = columns.map((col) => `<th>${col}</th>`).join('');
    body.innerHTML = rows
      .map((row) => `<tr>${columns.map((col) => `<td>${row[col] || ''}</td>`).join('')}</tr>`)
      .join('');

    status.style.display = 'none';
    table.style.display = 'table';
  } catch (err) {
    status.textContent = `Could not load feedback (${err.message}).`;
    status.style.display = 'block';
    table.style.display = 'none';
  }
}
