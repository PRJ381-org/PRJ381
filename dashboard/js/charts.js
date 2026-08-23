/**
 * Charts and Visualizations Module.
 *
 * Provides Chart.js wrappers for dashboard analytics styled with Belgium Campus branding.
 */

let eventTypeChartInstance = null;
let areaChartInstance = null;
let hotspotChartInstance = null;

const darkGridOptions = {
  grid: { color: '#232936' },
  ticks: { color: '#8e95a2', font: { size: 11 } },
};

/**
 * Renders or updates a doughnut chart showing the distribution of VR event types.
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

  // Belgium Campus Brand Theme Colors
  const backgroundColors = [
    '#e0292b', // Belgium Campus Red
    '#f5a623', // Belgium Campus Gold / Yellow
    '#2ecc71', // Mint Green
    '#3b82f6', // Slate Blue
    '#9b59b6', // Amethyst Purple
    '#e67e22', // Deep Orange
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
          borderColor: '#13171f',
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
            color: '#8e95a2',
            font: { size: 11 },
            padding: 12,
          },
        },
      },
    },
  });
}

/**
 * Renders or updates a bar chart showing time/visits across campus areas.
 */
export function renderAreaChart(canvasId, areaData = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = Object.keys(areaData);
  const data = Object.values(areaData);

  if (labels.length === 0) {
    labels.push('No area data');
    data.push(0);
  }

  if (areaChartInstance) {
    areaChartInstance.destroy();
  }

  areaChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map((l) => l.replace(/^(LVL_|BP_)/i, '').replace(/_/g, ' ')),
      datasets: [
        {
          label: 'Activity (sec / events)',
          data: data,
          backgroundColor: '#e0292b', // Brand Red
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: darkGridOptions,
        y: { ...darkGridOptions, beginAtZero: true },
      },
    },
  });
}

/**
 * Renders or updates a horizontal bar chart showing top interacted hotspots.
 */
export function renderHotspotChart(canvasId, hotspotData = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = Object.keys(hotspotData);
  const data = Object.values(hotspotData);

  if (labels.length === 0) {
    labels.push('No hotspot data');
    data.push(0);
  }

  if (hotspotChartInstance) {
    hotspotChartInstance.destroy();
  }

  hotspotChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map((l) => l.replace(/^(BP_|hotspot_)/i, '').replace(/_/g, ' ')),
      datasets: [
        {
          label: 'Views',
          data: data,
          backgroundColor: '#f5a623', // Brand Gold / Yellow
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { ...darkGridOptions, beginAtZero: true },
        y: darkGridOptions,
      },
    },
  });
}

export function renderTimelineChart(canvasId, timelineData) {
  // Placeholder for future session timeline chart
}
