/**
 * Data Export Module.
 *
 * Scaffolding for downloading CSV reports.
 */
import { API_BASE_URL } from './api.js';

export function triggerCsvDownload(endpoint, defaultFilename) {
  const token = sessionStorage.getItem('token');
  const url = `${API_BASE_URL}${endpoint}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadLeadsCsv() {
  triggerCsvDownload('/api/export/leads', 'leads_export.csv');
}

export function downloadAnalyticsCsv() {
  triggerCsvDownload('/api/export/analytics', 'analytics_export.csv');
}
