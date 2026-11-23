let barChartInstance = null;
let lineChartInstance = null;

export function updateAnalytics(games) {
  if (!Array.isArray(games) || games.length === 0) return;

  const sortedGames = [...games].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
  const top10 = sortedGames.slice(0, 10);
  const barGames = [...top10].reverse();

  const labels = barGames.map((g) => g.name);
  const exactHours = barGames.map((g) => Number(((g.playtime_forever || 0) / 60).toFixed(1)));
  // Для логарифмической оси избегаем 0, сохраняя реальное число в тултипе
  const logSafeValues = exactHours.map((h) => (h > 0 ? h : 0.1));

  const barCtx = document.getElementById('barChart');
  if (barCtx && window.Chart) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new window.Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Hours Played',
            data: logSafeValues,
            realHours: exactHours,
            backgroundColor: 'rgba(168, 85, 247, 0.7)',
            borderColor: 'rgba(168, 85, 247, 1)',
            borderWidth: 1,
            borderRadius: 5,
            animation: { duration: 1200, easing: 'easeOutQuart' },
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'logarithmic',
            min: 0.1,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#9ca3af', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.realHours[ctx.dataIndex]} h`,
            },
          },
        },
      },
    });
  }

  const lineCtx = document.getElementById('lineChart');
  if (lineCtx && window.Chart) {
    if (lineChartInstance) lineChartInstance.destroy();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const randomData = days.map(() => Math.floor(Math.random() * 5));
    lineChartInstance = new window.Chart(lineCtx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Hours per Day',
            data: randomData,
            borderColor: 'rgba(34, 211, 238, 1)',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#0a0a0f',
            pointBorderColor: 'rgba(34, 211, 238, 1)',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  const totalMinutes = games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);

  const avgTimeEl = document.getElementById('analytics-avg-time');
  const topGameEl = document.getElementById('analytics-top-game');
  const totalGamesEl = document.getElementById('analytics-total-games');
  const valueEl = document.getElementById('analytics-value');

  if (avgTimeEl) avgTimeEl.textContent = `${Math.round(totalHours / games.length)} hours/game`;
  if (topGameEl) topGameEl.textContent = top10[0].name;
  if (totalGamesEl) totalGamesEl.textContent = String(games.length);
  if (valueEl) valueEl.textContent = String(games.length * 15);
}