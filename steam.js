import { supabaseClient, prefs, formatPlaytime, escapeHtml, animateValue } from './config.js';
import { updateAnalytics } from './analytics.js';

let lastSteamData = null;

export function getLastSteamData() {
  return lastSteamData;
}

export function toggleEmptyStates(hasGames) {
  const topEmpty = document.getElementById('top-game-empty');
  const podiumEmpty = document.getElementById('podium-empty');
  const podiumWrapper = document.getElementById('podium-wrapper');

  topEmpty?.classList.toggle('hidden', hasGames);
  podiumEmpty?.classList.toggle('hidden', hasGames);
  podiumWrapper?.classList.toggle('hidden', !hasGames);
}

function applyRankPalette(totalHours) {
  let themeColor = '#a855f7';
  let themeGradient = 'linear-gradient(135deg, #a855f7 0%, #2563eb 100%)';

  if (totalHours < 500) {
    themeColor = prefs.theme === 'light' ? '#92400e' : '#cd7f32';
    themeGradient = prefs.theme === 'light'
      ? 'linear-gradient(135deg, #92400e 0%, #78350f 100%)'
      : 'linear-gradient(135deg, #cd7f32 0%, #a0522d 100%)';
  } else if (totalHours < 1000) {
    themeColor = prefs.theme === 'light' ? '#4b5563' : '#c0c0c0';
    themeGradient = prefs.theme === 'light'
      ? 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)'
      : 'linear-gradient(135deg, #c0c0c0 0%, #94a3b8 100%)';
  } else if (totalHours < 5000) {
    themeColor = prefs.theme === 'light' ? '#b45309' : '#ffd700';
    themeGradient = prefs.theme === 'light'
      ? 'linear-gradient(135deg, #b45309 0%, #78350f 100%)'
      : 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)';
  } else {
    themeColor = prefs.theme === 'light' ? '#0891b2' : '#22d3ee';
    themeGradient = prefs.theme === 'light'
      ? 'linear-gradient(135deg, #0891b2 0%, #164e63 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #22d3ee 100%)';
  }

  document.querySelectorAll('.btn-gradient, .bg-purple-600').forEach((btn) => {
    btn.style.background = themeGradient;
  });
  document.querySelectorAll('.text-purple-400').forEach((el) => {
    el.style.color = themeColor;
  });
  document.querySelectorAll('.glass-card').forEach((card) => {
    card.style.boxShadow = prefs.theme === 'light' ? '0 4px 6px rgba(0,0,0,0.05)' : `0 0 15px ${themeColor}40`;
    card.style.borderColor = prefs.theme === 'light' ? 'rgba(0,0,0,0.1)' : themeColor;
  });

  const totalHoursEl = document.getElementById('stat-total-hours');
  if (totalHoursEl) totalHoursEl.style.color = themeColor;

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.style.borderColor = themeColor;
    avatarEl.style.boxShadow = prefs.theme === 'light' ? 'none' : `0 0 20px ${themeColor}`;
  }
}

export function renderSteamGames(data) {
  const games = data?.response?.games;
  const hasGames = Array.isArray(games) && games.length > 0;
  toggleEmptyStates(hasGames);

  const gamesTbody = document.getElementById('games-tbody');
  if (!hasGames) {
    if (gamesTbody) {
      gamesTbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">No games found in this Steam library.</td></tr>';
    }
    return;
  }

  lastSteamData = data;
  const totalGames = games.length;
  const totalMinutes = games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);
  const suffix = prefs.timeFormat === 'days' ? 'd' : 'h';

  const totalGamesEl = document.getElementById('stat-total-games');
  const totalHoursEl = document.getElementById('stat-total-hours');
  const hoursCard = document.getElementById('hours-card');

  if (totalGamesEl) totalGamesEl.textContent = totalGames.toLocaleString();
  if (totalHoursEl) {
    totalHoursEl.classList.remove('stat-number');
    animateValue(totalHoursEl, 0, prefs.timeFormat === 'days' ? Math.round(totalHours / 24) : totalHours, 1500, suffix);
    setTimeout(() => totalHoursEl.classList.add('stat-number'), 1500);
  }
  if (hoursCard) {
    hoursCard.classList.remove('stat-number');
    animateValue(hoursCard, 0, prefs.timeFormat === 'days' ? Math.round(totalHours / 24) : totalHours, 1500, suffix);
    setTimeout(() => hoursCard.classList.add('stat-number'), 1500);
  }

  const avgHours = totalHours / totalGames;
  let playstyleLabel = 'Collector';
  let playstyleDesc = 'Game collector';
  if (avgHours > 20) {
    playstyleLabel = 'Devoted';
    playstyleDesc = 'Dedicated player';
  } else if (avgHours >= 5) {
    playstyleLabel = 'Balanced';
    playstyleDesc = 'Balanced player';
  }

  const playstyleLabelEl = document.getElementById('stat-playstyle-label');
  const playstyleAvgEl = document.getElementById('stat-playstyle-avg');
  if (playstyleLabelEl) playstyleLabelEl.textContent = playstyleLabel;
  if (playstyleAvgEl) playstyleAvgEl.textContent = `${avgHours.toFixed(1)} h/game • ${playstyleDesc}`;

  const sortedGames = [...games].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));

  const topGame = sortedGames[0];
  const topNameEl = document.getElementById('top-game-name');
  const topHoursEl = document.getElementById('top-game-hours');
  const topIconEl = document.getElementById('top-game-icon');

  if (topNameEl) topNameEl.textContent = topGame.name;
  if (topHoursEl) {
    const topHours = Math.round((topGame.playtime_forever || 0) / 60);
    topHoursEl.textContent = `${formatPlaytime(topHours)} played`;
  }
  if (topIconEl) {
    if (topGame.img_icon_url) {
      topIconEl.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${topGame.appid}/${topGame.img_icon_url}.jpg`;
      topIconEl.classList.remove('hidden');
    } else {
      topIconEl.classList.add('hidden');
    }
  }

  for (let i = 0; i < 3; i++) {
    const game = sortedGames[i];
    const rank = i + 1;
    const imgEl = document.getElementById(`podium-img-${rank}`);
    const nameEl = document.getElementById(`podium-name-${rank}`);
    if (game) {
      if (nameEl) nameEl.textContent = game.name;
      if (imgEl && game.img_icon_url) {
        imgEl.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
        imgEl.style.display = 'block';
      } else if (imgEl) {
        imgEl.style.display = 'none';
      }
    } else {
      if (nameEl) nameEl.textContent = '—';
      if (imgEl) imgEl.style.display = 'none';
    }
  }

  applyRankPalette(totalHours);

  if (gamesTbody) {
    gamesTbody.innerHTML = '';
    sortedGames.forEach((game, idx) => {
      const iconUrl = game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : null;
      const hours = Math.round((game.playtime_forever || 0) / 60);

      let lastPlayedText = '—';
      if (game.rtime_last_played && game.rtime_last_played > 0) {
        const date = new Date(game.rtime_last_played * 1000);
        lastPlayedText = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      const safeName = escapeHtml(game.name || 'Unknown Game');
      const firstLetter = escapeHtml((game.name || 'G').charAt(0).toUpperCase());

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/3 transition group row-animate';
      tr.style.animationDelay = `${Math.min(idx * 40, 800)}ms`;
      tr.innerHTML = `
        <td class="px-6 py-4" data-label="Game">
          <div class="flex items-center gap-3">
            ${iconUrl
              ? `<img src="${escapeHtml(iconUrl)}" class="w-10 h-10 rounded-lg object-cover" alt="${safeName}" />`
              : `<div class="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-white font-bold">${firstLetter}</div>`}
            <div class="text-left">
              <p class="font-medium text-white">${safeName}</p>
              <p class="text-xs text-gray-500">Steam • App ${escapeHtml(game.appid)}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4" data-label="Playtime"><span class="text-white font-mono text-sm">${escapeHtml(formatPlaytime(hours))}</span></td>
        <td class="px-6 py-4 text-gray-400 text-sm" data-label="Last Played">${escapeHtml(lastPlayedText)}</td>
      `;
      gamesTbody.appendChild(tr);
    });
  }
}

export async function autoLoadSteamGames() {
  const steamAutoLoadEl = document.getElementById('steam-auto-load');
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) return;

  const { data: profile, error: dbError } = await supabaseClient
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single();

  if (dbError || !profile?.steam_id) return;

  const steamBtn = document.getElementById('connect-steam-btn');
  const steamBtnText = document.getElementById('steam-btn-text');
  const instructionText = document.getElementById('steam-instruction-text');
  const connectTitle = document.getElementById('connect-platform-title');

  if (steamBtn && steamBtnText) {
    steamBtnText.textContent = 'Steam Connected';
    steamBtn.removeAttribute('href');
    steamBtn.classList.remove('btn-gradient');
    steamBtn.classList.add('bg-green-600/20', 'border', 'border-green-500/50', 'cursor-default');
    const svgIcon = steamBtn.querySelector('svg');
    if (svgIcon) svgIcon.style.display = 'none';
  }

  instructionText?.classList.add('hidden');
  connectTitle?.classList.add('hidden');
  steamAutoLoadEl?.classList.remove('hidden');

  try {
    const { data, error } = await supabaseClient.functions.invoke('steam-api', {
      body: { steamid: profile.steam_id },
    });
    if (!error && data?.response?.games) {
      renderSteamGames(data);
      updateAnalytics(data.response.games);
    }
  } catch (e) {
    console.error('Failed to auto-load Steam games:', e);
  } finally {
    steamAutoLoadEl?.classList.add('hidden');
  }
}

export function buildDemoData() {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  return {
    response: {
      games: [
        { appid: 730, name: 'Counter-Strike 2', playtime_forever: 18240, img_icon_url: '', rtime_last_played: now - day * 2 },
        { appid: 570, name: 'Dota 2', playtime_forever: 14520, img_icon_url: '', rtime_last_played: now - day * 5 },
        { appid: 1091500, name: 'Cyberpunk 2077', playtime_forever: 6210, img_icon_url: '', rtime_last_played: now - day * 10 },
        { appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 4980, img_icon_url: '', rtime_last_played: now - day * 30 },
        { appid: 1174180, name: 'Red Dead Redemption 2', playtime_forever: 3120, img_icon_url: '', rtime_last_played: now - day * 15 },
        { appid: 271590, name: 'Grand Theft Auto V', playtime_forever: 2880, img_icon_url: '', rtime_last_played: now - day * 7 },
        { appid: 413150, name: 'Stardew Valley', playtime_forever: 1740, img_icon_url: '', rtime_last_played: now - day * 3 },
        { appid: 105600, name: 'Terraria', playtime_forever: 960, img_icon_url: '', rtime_last_played: now - day * 40 },
        { appid: 400, name: 'Portal 2', playtime_forever: 480, img_icon_url: '', rtime_last_played: now - day * 60 },
        { appid: 620, name: 'Portal 2 (Beta)', playtime_forever: 120, img_icon_url: '', rtime_last_played: now - day * 90 },
      ],
    },
  };
}