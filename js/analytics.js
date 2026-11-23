import { formatPlaytime } from './config.js';

let barChartInstance = null;
let lineChartInstance = null;

function getTierColorHex() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--tier-color').trim();
  return raw || '#a855f7';
}

export function updateAnalytics(games) {
  if (!Array.isArray(games) || games.length === 0) return;

  const totalGames = games.length;
  const totalMinutes = games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);
  const avgHours = totalHours / totalGames;

  const sortedByTotal = [...games].sort(
    (a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0)
  );
  const topGame = sortedByTotal[0];

  // --- 1. FUN FACTS ---
  const avgEl = document.getElementById('analytics-avg-time');
  const topEl = document.getElementById('analytics-top-game');
  const totalEl = document.getElementById('analytics-total-games');

  if (avgEl) avgEl.textContent = `${avgHours.toFixed(1)} hours/game`;
  if (topEl) {
    const topH = Math.round((topGame?.playtime_forever || 0) / 60);
    topEl.textContent = topGame ? `${topGame.name} (${formatPlaytime(topH)})` : '—';
  }
  if (totalEl) totalEl.textContent = totalGames.toLocaleString();

  // --- 2. РЕАЛЬНАЯ СТОИМОСТЬ БИБЛИОТЕКИ ИЗ STEAM STORE ---
  const valueEl = document.getElementById('analytics-value');
  const valueNoteEl = valueEl?.closest('.glass-card')?.querySelector('p.text-xs');

  const hasRealPrices = games.some((g) => typeof g.price_usd === 'number');
  if (hasRealPrices) {
    const currentTotal = games.reduce((sum, g) => sum + (Number(g.price_usd) || 0), 0);
    const fullTotal = games.reduce(
      (sum, g) => sum + (Number(g.initial_price_usd) || Number(g.price_usd) || 0),
      0
    );
    const paidCount = games.filter((g) => (Number(g.price_usd) || 0) > 0).length;
    const mostExpensive = [...games].sort(
      (a, b) => (Number(b.price_usd) || 0) - (Number(a.price_usd) || 0)
    )[0];

    if (valueEl) {
      valueEl.textContent = currentTotal.toLocaleString('en-US', {
        minimumFractionDigits: currentTotal % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    }

    if (valueNoteEl) {
      const parts = [
        `Steam Store US prices • ${paidCount} paid / ${totalGames - paidCount} free`,
      ];
      if (fullTotal > currentTotal) {
        parts.push(`Full retail: $${fullTotal.toFixed(0)}`);
      }
      if (mostExpensive && Number(mostExpensive.price_usd) > 0) {
        parts.push(`Top: ${mostExpensive.name} ($${Number(mostExpensive.price_usd).toFixed(2)})`);
      }
      valueNoteEl.textContent = parts.join(' • ');
    }
  } else {
    const fallbackValue = totalGames * 15;
    if (valueEl) valueEl.textContent = fallbackValue.toLocaleString();
    if (valueNoteEl) valueNoteEl.textContent = '*Approximate value (Steam prices unavailable)';
  }

  // --- 3. ГРАФИК TOP 10 GAMES BY HOURS ---
  const tierColor = getTierColorHex();
  const top10 = sortedByTotal.slice(0, 10);
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  if (barCtx) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: top10.map((g) => g.name),
        datasets: [
          {
            label: 'Hours Played',
            data: top10.map((g) => Math.round((g.playtime_forever || 0) / 60)),
            backgroundColor: `${tierColor}99`,
            borderColor: tierColor,
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} hrs`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af', maxRotation: 35, minRotation: 0 },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }

  // --- 4. РЕАЛЬНАЯ АКТИВНОСТЬ ЗА ПОСЛЕДНИЕ 2 НЕДЕЛИ ---
  const recentGames = [...games]
    .filter((g) => (g.playtime_2weeks || 0) > 0)
    .sort((a, b) => (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0));

  const lineCtx = document.getElementById('lineChart')?.getContext('2d');
  if (lineCtx) {
    if (lineChartInstance) lineChartInstance.destroy();

    if (recentGames.length === 0) {
      lineChartInstance = new Chart(lineCtx, {
        type: 'bar',
        data: {
          labels: ['No activity in last 14 days'],
          datasets: [
            {
              label: 'Hours (2 weeks)',
              data: [0],
              backgroundColor: 'rgba(34, 211, 238, 0.25)',
              borderColor: '#22d3ee',
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#6b7280' }, grid: { display: false } },
            y: {
              beginAtZero: true,
              max: 5,
              ticks: { color: '#6b7280' },
              grid: { color: 'rgba(255,255,255,0.05)' },
            },
          },
        },
      });
    } else {
      lineChartInstance = new Chart(lineCtx, {
        type: 'bar',
        data: {
          labels: recentGames.map((g) => g.name),
          datasets: [
            {
              label: 'Hours in last 2 weeks',
              data: recentGames.map((g) => Number(((g.playtime_2weeks || 0) / 60).toFixed(1))),
              backgroundColor: 'rgba(34, 211, 238, 0.55)',
              borderColor: '#22d3ee',
              borderWidth: 1.5,
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.parsed.x} hrs in last 2 weeks`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: '#9ca3af', callback: (v) => `${v}h` },
              grid: { color: 'rgba(255,255,255,0.05)' },
            },
            y: {
              ticks: { color: '#e5e7eb' },
              grid: { display: false },
            },
          },
        },
      });
    }
  }
}
