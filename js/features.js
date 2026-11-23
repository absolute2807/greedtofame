import { supabaseClient, formatPlaytime, escapeHtml } from './config.js';
import { getLastSteamData } from './steam.js';

// --- 1. МОДАЛЬНОЕ ОКНО ЛИДЕРБОРДА ---
export function openLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  const backdrop = document.getElementById('leaderboard-modal-backdrop');
  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  renderLeaderboard();
}

export function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  const backdrop = document.getElementById('leaderboard-modal-backdrop');
  modal?.classList.add('hidden');
  backdrop?.classList.add('hidden');
}

export async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  container.innerHTML = '<p class="text-xs text-gray-400 py-4 text-center">Loading leaderboard...</p>';

  try {
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url, steam_id')
      .limit(20);

    if (error) {
      console.error('Leaderboard profiles error:', error);
      container.innerHTML = '<p class="text-xs text-red-400 py-4 text-center">Failed to load profiles.</p>';
      return;
    }

    if (!Array.isArray(profiles) || profiles.length === 0) {
      container.innerHTML = '<p class="text-xs text-gray-500 py-4 text-center">No players in leaderboard yet.</p>';
      return;
    }

    const enriched = await Promise.all(
      profiles.map(async (p) => {
        let totalHours = 0;
        let gamesCount = 0;
        let topGameName = '—';

        if (p.steam_id) {
          try {
            const { data } = await supabaseClient.functions.invoke('steam-api', {
              body: { steamid: String(p.steam_id) },
            });
            const list = data?.games?.games ?? data?.response?.games ?? [];
            if (Array.isArray(list) && list.length > 0) {
              gamesCount = list.length;
              const mins = list.reduce((acc, g) => acc + (Number(g.playtime_forever) || 0), 0);
              totalHours = Math.round(mins / 60);
              const sorted = [...list].sort(
                (a, b) => (Number(b.playtime_forever) || 0) - (Number(a.playtime_forever) || 0)
              );
              topGameName = sorted[0]?.name || '—';
            }
          } catch (_err) {
            // Если у конкретного игрока не удалось получить данные Steam — оставляем 0h
          }
        }

        return { ...p, totalHours, gamesCount, topGameName };
      })
    );

    enriched.sort((a, b) => b.totalHours - a.totalHours);

    container.innerHTML = '';
    enriched.forEach((player, index) => {
      const rank = index + 1;
      const name = player.username || 'Player';
      const avatarSrc =
        player.avatar_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;

      const medalClass =
        rank === 1
          ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
          : rank === 2
          ? 'text-slate-200 border-slate-400/40 bg-slate-400/10'
          : rank === 3
          ? 'text-amber-500 border-amber-500/40 bg-amber-500/10'
          : 'text-gray-400 border-white/10 bg-white/5';

      const row = document.createElement('div');
      row.className =
        'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition';
      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-extrabold shrink-0 ${medalClass}">#${rank}</span>
          <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-white truncate">${escapeHtml(name)}</p>
            <p class="text-[11px] text-gray-400 truncate">Top: ${escapeHtml(player.topGameName)} • ${player.gamesCount} games</p>
          </div>
        </div>
        <span class="text-sm font-mono font-bold text-purple-300 shrink-0">${escapeHtml(formatPlaytime(player.totalHours))}</span>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error('Leaderboard fatal error:', err);
    container.innerHTML = '<p class="text-xs text-red-400 py-4 text-center">Error loading leaderboard.</p>';
  }
}

// --- 2. РАНДОМАЙЗЕР «ВО ЧТО ПОИГРАТЬ СЕГОДНЯ?» ---
export function pickRandomGame() {
  const resultEl = document.getElementById('randomizer-result');
  const filterVal = document.getElementById('randomizer-filter')?.value || 'all';
  if (!resultEl) return;

  const steamData = getLastSteamData();
  const games = steamData?.response?.games;
  if (!Array.isArray(games) || games.length === 0) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML =
      '<p class="text-xs text-gray-400">Load or connect a Steam library (or enable Demo) first.</p>';
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const yearSec = 365 * 86400;

  let pool = games;
  if (filterVal === 'unplayed') {
    pool = games.filter((g) => (Number(g.playtime_forever) || 0) === 0);
  } else if (filterVal === 'dusty') {
    pool = games.filter((g) => {
      const last = Number(g.rtime_last_played) || 0;
      return last > 0 && nowSec - last > yearSec;
    });
  } else if (filterVal === 'light') {
    pool = games.filter((g) => {
      const h = (Number(g.playtime_forever) || 0) / 60;
      return h > 0 && h <= 15;
    });
  }

  if (pool.length === 0) pool = games;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  const hours = Math.round((Number(picked.playtime_forever) || 0) / 60);
  const bannerUrl = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${picked.appid}/header.jpg`;
  const launchUrl = `steam://run/${picked.appid}`;

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
      <img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(picked.name)}" class="w-full h-28 object-cover" onerror="this.style.display='none'" />
      <div class="p-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-bold text-white truncate">${escapeHtml(picked.name)}</p>
          <p class="text-[11px] text-gray-400">${escapeHtml(formatPlaytime(hours))} played</p>
        </div>
        <a href="${escapeHtml(launchUrl)}" class="px-3 py-1.5 text-xs font-bold rounded-lg btn-gradient text-white shrink-0">
          Launch ▶
        </a>
      </div>
    </div>
  `;
}

// --- 3. FLEX CARD В МОДАЛЬНОМ ОКНЕ (ВМЕСТО SHARE PROFILE) ---
export function openFlexCardModal() {
  const modal = document.getElementById('flex-card-modal');
  const backdrop = document.getElementById('flex-card-modal-backdrop');
  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  generateFlexCard();
}

export function closeFlexCardModal() {
  const modal = document.getElementById('flex-card-modal');
  const backdrop = document.getElementById('flex-card-modal-backdrop');
  modal?.classList.add('hidden');
  backdrop?.classList.add('hidden');
}

export function generateFlexCard() {
  const canvas = document.getElementById('flex-card-canvas');
  const downloadLink = document.getElementById('flex-card-download');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const username = document.getElementById('profile-username')?.textContent || 'Player';
  const tierText = document.getElementById('playtime-tier-badge')?.textContent || 'Standard';
  const totalGamesText = document.getElementById('stat-total-games')?.textContent || '0';
  const totalHoursText = document.getElementById('stat-total-hours')?.textContent || '0h';

  const p1 = document.getElementById('podium-name-1')?.textContent || '—';
  const p1h = document.getElementById('podium-hours-1')?.textContent || '0h';
  const p2 = document.getElementById('podium-name-2')?.textContent || '—';
  const p2h = document.getElementById('podium-hours-2')?.textContent || '0h';
  const p3 = document.getElementById('podium-name-3')?.textContent || '—';
  const p3h = document.getElementById('podium-hours-3')?.textContent || '0h';

  const w = canvas.width;
  const h = canvas.height;

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#0d0b1a');
  bgGrad.addColorStop(0.55, '#16112b');
  bgGrad.addColorStop(1, '#090d18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.82, h * 0.2, 20, w * 0.82, h * 0.2, 340);
  glow.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
  glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.fillStyle = '#c084fc';
  ctx.font = '800 22px Outfit, sans-serif';
  ctx.fillText('GREEDTOFAME // GAMER CARD', 48, 66);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px Outfit, sans-serif';
  ctx.fillText(username.slice(0, 22), 48, 124);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 20px Outfit, sans-serif';
  ctx.fillText(`Tier: ${tierText}`, 48, 160);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 16px Outfit, sans-serif';
  ctx.fillText('TOTAL PLAYTIME', 48, 220);
  ctx.fillText('TOTAL GAMES', 280, 220);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px Outfit, sans-serif';
  ctx.fillText(totalHoursText, 48, 258);
  ctx.fillText(totalGamesText, 280, 258);

  ctx.fillStyle = '#a855f7';
  ctx.font = '700 18px Outfit, sans-serif';
  ctx.fillText('TOP 3 GAMES', 490, 96);

  const podiumRows = [
    { label: `#1 ${p1}`, hrs: p1h, color: '#facc15', y: 142 },
    { label: `#2 ${p2}`, hrs: p2h, color: '#e2e8f0', y: 192 },
    { label: `#3 ${p3}`, hrs: p3h, color: '#fb923c', y: 242 },
  ];

  podiumRows.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.font = '700 20px Outfit, sans-serif';
    ctx.fillText(`${item.label.slice(0, 24)} — ${item.hrs}`, 490, item.y);
  });

  if (downloadLink) {
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.download = `${username.toLowerCase().replace(/[^a-z0-9_-]+/gi, '_')}_greedtofame.png`;
  }
}

export function initFeatures() {
  document.getElementById('open-leaderboard-btn')?.addEventListener('click', openLeaderboardModal);
  document.getElementById('close-leaderboard-btn')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('leaderboard-modal-backdrop')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', renderLeaderboard);

  document.getElementById('randomizer-pick-btn')?.addEventListener('click', pickRandomGame);

  document.getElementById('share-profile-btn')?.addEventListener('click', openFlexCardModal);
  document.getElementById('close-flex-card-btn')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-modal-backdrop')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-regenerate-btn')?.addEventListener('click', generateFlexCard);
}
