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

// Смена оформления в зависимости от общего количества часов:
// < 500h -> Bronze | 500–999h -> Silver | 1000–4999h -> Gold | 5000h+ -> Cyan
export function applyPlaytimeTier(totalHours) {
  const root = document.documentElement;
  const badgeEl = document.getElementById('playtime-tier-badge');

  let color = '#a855f7';
  let gradient = 'linear-gradient(135deg, #a855f7 0%, #2563eb 100%)';
  let tierName = 'Standard';

  if (totalHours > 0 && totalHours < 500) {
    color = prefs.theme === 'light' ? '#b45309' : '#cd7f32';
    gradient = 'linear-gradient(135deg, #cd7f32 0%, #78350f 100%)';
    tierName = 'Bronze • <500h';
  } else if (totalHours >= 500 && totalHours < 1000) {
    color = prefs.theme === 'light' ? '#475569' : '#cbd5e1';
    gradient = 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)';
    tierName = 'Silver • 500h+';
  } else if (totalHours >= 1000 && totalHours < 5000) {
    color = prefs.theme === 'light' ? '#b45309' : '#facc15';
    gradient = 'linear-gradient(135deg, #facc15 0%, #d97706 100%)';
    tierName = 'Gold • 1000h+';
  } else if (totalHours >= 5000) {
    color = prefs.theme === 'light' ? '#0284c7' : '#22d3ee';
    gradient = 'linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)';
    tierName = 'Apex • 5000h+';
  }

  root.style.setProperty('--tier-color', color);
  root.style.setProperty('--tier-gradient', gradient);

  if (badgeEl) {
    badgeEl.textContent = tierName;
    badgeEl.style.color = color;
    badgeEl.style.borderColor = `${color}66`;
  }

  const totalHoursEl = document.getElementById('stat-total-hours');
  if (totalHoursEl) totalHoursEl.style.color = color;

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.style.borderColor = color;
    avatarEl.style.boxShadow = prefs.theme === 'light' ? 'none' : `0 0 20px ${color}66`;
  }
}

export function renderSteamGames(data) {
  const games = data?.response?.games ?? data?.games?.games;
  const hasGames = Array.isArray(games) && games.length > 0;
  toggleEmptyStates(hasGames);

  const gamesTbody = document.getElementById('games-tbody');
  if (!hasGames) {
    applyPlaytimeTier(0);
    if (gamesTbody) {
      gamesTbody.innerHTML =
        '<tr><td colspan="3" class="px-6 py-8 text-center text-gray-400">No games found in this Steam library. Check if Steam Game Details privacy is set to Public.</td></tr>';
    }
    return;
  }

  lastSteamData = { response: { games } };

  const totalGames = games.length;
  const totalMinutes = games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);

  const recentMinutes = games.reduce((sum, g) => sum + (g.playtime_2weeks || 0), 0);
  const recentHours = Math.round(recentMinutes / 60);

  applyPlaytimeTier(totalHours);

  const suffix = prefs.timeFormat === 'days' ? 'd' : 'h';
  const targetValue = prefs.timeFormat === 'days' ? Math.round(totalHours / 24) : totalHours;

  const totalGamesEl = document.getElementById('stat-total-games');
  const totalHoursEl = document.getElementById('stat-total-hours');
  const hoursCard = document.getElementById('hours-card');
  const recentHoursEl = document.getElementById('stat-recent-hours');

  if (totalGamesEl) totalGamesEl.textContent = totalGames.toLocaleString();
  if (recentHoursEl) recentHoursEl.textContent = `${recentHours}hrs in last 2 weeks`;

  if (totalHoursEl) animateValue(totalHoursEl, 0, targetValue, 1200, suffix);
  if (hoursCard) animateValue(hoursCard, 0, targetValue, 1200, suffix);

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

  // Top Game Card
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

  // Top 3 / Hall of Fame
  for (let i = 0; i < 3; i++) {
    const game = sortedGames[i];
    const rank = i + 1;
    const imgEl = document.getElementById(`podium-img-${rank}`);
    const bannerEl = document.getElementById(`podium-banner-${rank}`);
    const nameEl = document.getElementById(`podium-name-${rank}`);
    const hoursEl = document.getElementById(`podium-hours-${rank}`);

    if (game) {
      const gHours = Math.round((game.playtime_forever || 0) / 60);
      if (nameEl) nameEl.textContent = game.name;
      if (hoursEl) hoursEl.textContent = formatPlaytime(gHours);

      if (bannerEl) {
        bannerEl.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`;
        bannerEl.alt = game.name || '';
        bannerEl.onerror = () => {
          bannerEl.classList.add('hidden');
        };
        bannerEl.classList.remove('hidden');
      }

      if (imgEl && game.img_icon_url) {
        imgEl.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
        imgEl.style.display = 'block';
      } else if (imgEl) {
        imgEl.style.display = 'none';
      }
    } else {
      if (nameEl) nameEl.textContent = '—';
      if (hoursEl) hoursEl.textContent = '0h';
      if (imgEl) imgEl.style.display = 'none';
      if (bannerEl) bannerEl.classList.add('hidden');
    }
  }

  // Games Table
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
        lastPlayedText = date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }

      const safeName = escapeHtml(game.name || 'Unknown Game');
      const firstLetter = escapeHtml((game.name || 'G').charAt(0).toUpperCase());

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/[0.03] transition group row-animate';
      tr.style.animationDelay = `${Math.min(idx * 30, 700)}ms`;
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

    if (error) {
      console.error('steam-api invoke error:', error);
      return;
    }

    const gamesPayload = data?.games ?? data?.response ?? null;
    if (gamesPayload) {
      const normalizedData = { response: gamesPayload };
      renderSteamGames(normalizedData);
      if (Array.isArray(gamesPayload.games)) {
        updateAnalytics(gamesPayload.games);
      }
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
        { appid: 730, name: 'Counter-Strike 2', playtime_forever: 18240, playtime_2weeks: 640, img_icon_url: '', rtime_last_played: now - day * 2 },
        { appid: 570, name: 'Dota 2', playtime_forever: 14520, playtime_2weeks: 320, img_icon_url: '', rtime_last_played: now - day * 5 },
        { appid: 1091500, name: 'Cyberpunk 2077', playtime_forever: 6210, playtime_2weeks: 120, img_icon_url: '', rtime_last_played: now - day * 10 },
        { appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 4980, playtime_2weeks: 0, img_icon_url: '', rtime_last_played: now - day * 30 },
        { appid: 1174180, name: 'Red Dead Redemption 2', playtime_forever: 3120, playtime_2weeks: 90, img_icon_url: '', rtime_last_played: now - day * 15 },
        { appid: 271590, name: 'Grand Theft Auto V', playtime_forever: 2880, playtime_2weeks: 0, img_icon_url: '', rtime_last_played: now - day * 7 },
        { appid: 413150, name: 'Stardew Valley', playtime_forever: 1740, playtime_2weeks: 180, img_icon_url: '', rtime_last_played: now - day * 3 },
        { appid: 105600, name: 'Terraria', playtime_forever: 960, playtime_2weeks: 0, img_icon_url: '', rtime_last_played: now - day * 40 },
        { appid: 400, name: 'Portal 2', playtime_forever: 480, playtime_2weeks: 0, img_icon_url: '', rtime_last_played: now - day * 60 },
        { appid: 620, name: 'Portal 2 (Beta)', playtime_forever: 120, playtime_2weeks: 0, img_icon_url: '', rtime_last_played: now - day * 90 },
      ],
    },
  };
}
