/**
 * Charts and Visualizations Module.
 *
 * Provides Chart.js wrappers for dashboard analytics.
 */

let eventTypeChartInstance = null;

/**
 * Renders or updates a doughnut chart showing the distribution of VR event types.
 *
 * @param {string} canvasId - The canvas element ID.
 * @param {Object} eventsByType - Map of eventType -> count (from /api/analytics/summary).
 */
export function renderEventTypeChart(canvasId, eventsByType = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = Object.keys(eventsByType);
  const data = Object.values(eventsByType);

  if (labels.length === 0) {
    labels.push('No data');
    data.push(1);
  }

  const backgroundColors = [
    '#4f8cff', // accent blue
    '#38d39f', // mint green
    '#f5a623', // amber
    '#e056fd', // purple
    '#ff6b6b', // coral
    '#48dbfb', // cyan
  ];

  if (eventTypeChartInstance) {
    eventTypeChartInstance.destroy();
  }

  eventTypeChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels.map((l) => l.replace(/_/g, ' ')),
      datasets: [
        {
          data: data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderColor: '#171a21',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9aa0aa',
            font: { size: 12 },
            padding: 16,
          },
        },
      },
    },
  });
}

export function renderAreaChart(canvasId, areaData) {
  // Placeholder for future area dwell time chart
}

export function renderHotspotChart(canvasId, hotspotData) {
  // Placeholder for future hotspot rankings chart
}

export function renderTimelineChart(canvasId, timelineData) {
  // Placeholder for future session timeline chart
}
