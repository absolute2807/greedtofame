import {
  supabaseClient,
  STORAGE_KEYS,
  formatPlaytime,
  escapeHtml,
  applyPlaytimeTier,
  setActiveSteamId,
} from './config.js';
import { updateAnalytics } from './analytics.js';

let lastSteamData = null;

function isRu() {
  return localStorage.getItem(STORAGE_KEYS.lang) === 'ru';
}

export function getLastSteamData() {
  return lastSteamData;
}

function getPlaystyleSummary(games) {
  const ru = isRu();
  if (!Array.isArray(games) || games.length === 0) {
    return { label: '—', avg: '—' };
  }

  const totalMins = games.reduce((sum, g) => sum + (Number(g.playtime_forever) || 0), 0);
  const totalHours = totalMins / 60;
  const avgHours = totalHours / games.length;

  const sorted = [...games].sort(
    (a, b) => (Number(b.playtime_forever) || 0) - (Number(a.playtime_forever) || 0)
  );
  const topMins = Number(sorted[0]?.playtime_forever) || 0;
  const topShare = totalMins > 0 ? topMins / totalMins : 0;

  let label = ru ? 'Баланс' : 'Balanced';
  if (topShare >= 0.45 && totalHours >= 100) {
    label = ru ? 'Однолюб' : 'Specialist';
  } else if (games.length >= 25 && avgHours < 15) {
    label = ru ? 'Коллекционер' : 'Explorer';
  } else if (avgHours >= 40) {
    label = ru ? 'Марафонец' : 'Grinder';
  }

  const avgText = ru
    ? `Среднее: ${formatPlaytime(Math.round(avgHours))} / игра`
    : `Avg: ${formatPlaytime(Math.round(avgHours))} / game`;

  return { label, avg: avgText };
}

export function toggleEmptyStates(hasGames) {
  const podiumWrapper = document.getElementById('podium-wrapper');
  const podiumEmpty = document.getElementById('podium-empty');
  const topGameEmpty = document.getElementById('top-game-empty');
  const topGameIcon = document.getElementById('top-game-icon');
  const topGameName = document.getElementById('top-game-name');
  const topGameHours = document.getElementById('top-game-hours');

  if (podiumWrapper) podiumWrapper.classList.toggle('hidden', !hasGames);
  if (podiumEmpty) podiumEmpty.classList.toggle('hidden', hasGames);
  if (topGameEmpty) topGameEmpty.classList.toggle('hidden', hasGames);

  if (!hasGames) {
    if (topGameIcon) topGameIcon.classList.add('hidden');
    if (topGameName) topGameName.textContent = '—';
    if (topGameHours) topGameHours.textContent = '—';
  }
}

function formatLastPlayed(timestampSec) {
  const ts = Number(timestampSec) || 0;
  if (!ts) return isRu() ? 'Никогда' : 'Never';
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return isRu() ? 'Никогда' : 'Never';
  const locale = isRu() ? 'ru-RU' : 'en-GB';
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getGameIconUrl(game) {
  if (game?.img_icon_url) {
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
  }
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`;
}

function getGameBannerUrl(game) {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`;
}

function updateHallOfFame(sortedGames) {
  const slots = [
    {
      idx: 0,
      nameId: 'podium-name-1',
      hoursId: 'podium-hours-1',
      imgId: 'podium-img-1',
      bannerId: 'podium-banner-1',
    },
    {
      idx: 1,
      nameId: 'podium-name-2',
      hoursId: 'podium-hours-2',
      imgId: 'podium-img-2',
      bannerId: 'podium-banner-2',
    },
    {
      idx: 2,
      nameId: 'podium-name-3',
      hoursId: 'podium-hours-3',
      imgId: 'podium-img-3',
      bannerId: 'podium-banner-3',
    },
  ];

  slots.forEach(({ idx, nameId, hoursId, imgId, bannerId }) => {
    const game = sortedGames[idx];
    const nameEl = document.getElementById(nameId);
    const hoursEl = document.getElementById(hoursId);
    const imgEl = document.getElementById(imgId);
    const bannerEl = document.getElementById(bannerId);

    if (!game) {
      if (nameEl) nameEl.textContent = '—';
      if (hoursEl) hoursEl.textContent = formatPlaytime(0);
      if (imgEl) imgEl.classList.add('hidden');
      if (bannerEl) bannerEl.classList.add('hidden');
      return;
    }

    const hrs = Math.round((Number(game.playtime_forever) || 0) / 60);
    if (nameEl) nameEl.textContent = game.name || `App ${game.appid}`;
    if (hoursEl) hoursEl.textContent = formatPlaytime(hrs);

    if (imgEl) {
      imgEl.src = getGameIconUrl(game);
      imgEl.classList.remove('hidden');
      imgEl.onerror = () => imgEl.classList.add('hidden');
    }

    if (bannerEl) {
      bannerEl.src = getGameBannerUrl(game);
      bannerEl.classList.remove('hidden');
      bannerEl.onerror = () => bannerEl.classList.add('hidden');
    }
  });
}

export function renderFilteredGamesTable() {
  const tbody = document.getElementById('games-tbody');
  if (!tbody) return;

  const games = lastSteamData?.response?.games;
  if (!Array.isArray(games) || games.length === 0) {
    tbody.innerHTML = `
      <tr id="steam-placeholder">
        <td colspan="3" class="px-6 py-8 text-center text-gray-400">
          ${isRu() ? 'Войди через Steam, чтобы увидеть свои игры' : 'Sign in with Steam to see your games'}
        </td>
      </tr>
    `;
    return;
  }

  const searchQuery = (document.getElementById('game-search-input')?.value || '').trim().toLowerCase();
  const sortMode = document.getElementById('game-sort-select')?.value || 'playtime_desc';

  let list = [...games];
  if (searchQuery) {
    list = list.filter((g) => String(g.name || '').toLowerCase().includes(searchQuery));
  }

  list.sort((a, b) => {
    if (sortMode === 'playtime_asc') {
      return (Number(a.playtime_forever) || 0) - (Number(b.playtime_forever) || 0);
    }
    if (sortMode === 'name_asc') {
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (sortMode === 'last_played_desc') {
      return (Number(b.rtime_last_played) || 0) - (Number(a.rtime_last_played) || 0);
    }
    return (Number(b.playtime_forever) || 0) - (Number(a.playtime_forever) || 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-8 text-center text-gray-400">
          ${isRu() ? 'По вашему запросу игры не найдены.' : 'No games match your search.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  const ru = isRu();
  const colGameLabel = ru ? 'Игра' : 'Game';
  const colPlaytimeLabel = ru ? 'Время' : 'Playtime';
  const colLastPlayedLabel = ru ? 'Последний запуск' : 'Last Played';

  list.forEach((game) => {
    const hours = Math.round((Number(game.playtime_forever) || 0) / 60);
    const formattedTime = formatPlaytime(hours);
    const lastPlayed = formatLastPlayed(game.rtime_last_played);
    const iconUrl = getGameIconUrl(game);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/[0.04] transition-colors cursor-pointer';
    tr.innerHTML = `
      <td class="px-6 py-4" data-label="${escapeHtml(colGameLabel)}">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(game.name || '')}" class="w-8 h-8 rounded object-cover shrink-0 border border-white/10" onerror="this.style.display='none'" />
          <span class="font-semibold text-white truncate">${escapeHtml(game.name || `App ${game.appid}`)}</span>
        </div>
      </td>
      <td class="px-6 py-4 font-mono text-sm text-gray-200" data-label="${escapeHtml(colPlaytimeLabel)}">${escapeHtml(formattedTime)}</td>
      <td class="px-6 py-4 text-sm text-gray-400" data-label="${escapeHtml(colLastPlayedLabel)}">${escapeHtml(lastPlayed)}</td>
    `;

    tr.addEventListener('click', () => {
      if (typeof window.__gtf_openGameDetails === 'function') {
        window.__gtf_openGameDetails(game);
      }
    });

    tbody.appendChild(tr);
  });
}

export function renderSteamGames(steamData) {
  lastSteamData = steamData;

  const games = steamData?.response?.games;
  const hasGames = Array.isArray(games) && games.length > 0;

  toggleEmptyStates(hasGames);

  if (!hasGames) {
    applyPlaytimeTier(0, isRu());

    const totalGamesEl = document.getElementById('stat-total-games');
    const totalHoursEl = document.getElementById('stat-total-hours');
    const hoursCardEl = document.getElementById('hours-card');
    const recentEl = document.getElementById('stat-recent-hours');
    const styleLabelEl = document.getElementById('stat-playstyle-label');
    const styleAvgEl = document.getElementById('stat-playstyle-avg');

    if (totalGamesEl) totalGamesEl.textContent = '0';
    if (totalHoursEl) totalHoursEl.textContent = formatPlaytime(0);
    if (hoursCardEl) hoursCardEl.textContent = formatPlaytime(0);
    if (recentEl) {
      recentEl.textContent = isRu() ? '0ч за последние 2 недели' : '0hrs in last 2 weeks';
    }
    if (styleLabelEl) styleLabelEl.textContent = '—';
    if (styleAvgEl) styleAvgEl.textContent = '—';

    updateHallOfFame([]);
    renderFilteredGamesTable();
    return;
  }

  const totalMinutes = games.reduce((sum, g) => sum + (Number(g.playtime_forever) || 0), 0);
  const recentMinutes = games.reduce((sum, g) => sum + (Number(g.playtime_2weeks) || 0), 0);
  const totalHours = Math.round(totalMinutes / 60);
  const recentHours = (recentMinutes / 60).toFixed(1);

  applyPlaytimeTier(totalHours, isRu());

  const totalGamesEl = document.getElementById('stat-total-games');
  const totalHoursEl = document.getElementById('stat-total-hours');
  const hoursCardEl = document.getElementById('hours-card');
  const recentEl = document.getElementById('stat-recent-hours');

  if (totalGamesEl) totalGamesEl.textContent = String(games.length);
  if (totalHoursEl) totalHoursEl.textContent = formatPlaytime(totalHours);
  if (hoursCardEl) hoursCardEl.textContent = formatPlaytime(totalHours);
  if (recentEl) {
    recentEl.textContent = isRu()
      ? `${recentHours}ч за последние 2 недели`
      : `${recentHours}hrs in last 2 weeks`;
  }

  const playstyle = getPlaystyleSummary(games);
  const styleLabelEl = document.getElementById('stat-playstyle-label');
  const styleAvgEl = document.getElementById('stat-playstyle-avg');
  if (styleLabelEl) styleLabelEl.textContent = playstyle.label;
  if (styleAvgEl) styleAvgEl.textContent = playstyle.avg;

  const sorted = [...games].sort(
    (a, b) => (Number(b.playtime_forever) || 0) - (Number(a.playtime_forever) || 0)
  );
  const topGame = sorted[0];

  const topGameIcon = document.getElementById('top-game-icon');
  const topGameName = document.getElementById('top-game-name');
  const topGameHours = document.getElementById('top-game-hours');

  if (topGame) {
    const topHours = Math.round((Number(topGame.playtime_forever) || 0) / 60);
    if (topGameName) topGameName.textContent = topGame.name || `App ${topGame.appid}`;
    if (topGameHours) {
      topGameHours.textContent = isRu()
        ? `${formatPlaytime(topHours)} наиграно`
        : `${formatPlaytime(topHours)} played`;
    }
    if (topGameIcon) {
      topGameIcon.src = getGameIconUrl(topGame);
      topGameIcon.classList.remove('hidden');
      topGameIcon.onerror = () => topGameIcon.classList.add('hidden');
    }
  }

  updateHallOfFame(sorted);
  renderFilteredGamesTable();
}

function applySteamPlayerSummary(player) {
  if (!player) return;

  const hasCustomName = Boolean(localStorage.getItem(STORAGE_KEYS.customName));
  if (!hasCustomName && player.personaname) {
    const welcomeEl = document.getElementById('welcome-username');
    const profileNameEl = document.getElementById('profile-username');
    const authBtnText = document.getElementById('auth-btn-text');
    if (welcomeEl) welcomeEl.textContent = player.personaname;
    if (profileNameEl) profileNameEl.textContent = player.personaname;
    if (authBtnText) authBtnText.textContent = player.personaname;
  }

  const avatarUrl = player.avatarfull || player.avatarmedium || player.avatar;
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarUrl && avatarEl && !avatarEl.dataset.custom) {
    avatarEl.src = avatarUrl;
    avatarEl.dataset.steamAvatar = 'true';
  }
}

export async function loadSteamStatsForId(
  steamId,
  { applyPlayer = true, updateOwnAnalytics = true } = {}
) {
  const autoLoadEl = document.getElementById('steam-auto-load');
  if (autoLoadEl) autoLoadEl.classList.remove('hidden');

  try {
    const { data, error } = await supabaseClient.functions.invoke('steam-api', {
      body: { steamid: String(steamId) },
    });

    if (error) {
      console.error('Steam API function error:', error);
      return null;
    }

    if (applyPlayer && data?.player) {
      applySteamPlayerSummary(data.player);
    }

    const rawGames = data?.games?.games ?? data?.response?.games ?? [];
    const normalizedData = { response: { games: Array.isArray(rawGames) ? rawGames : [] } };

    renderSteamGames(normalizedData);
    if (updateOwnAnalytics) {
      updateAnalytics(normalizedData.response.games);
    }

    return normalizedData;
  } catch (err) {
    console.error('Failed to load Steam stats:', err);
    return null;
  } finally {
    if (autoLoadEl) autoLoadEl.classList.add('hidden');
  }
}

export async function autoLoadSteamGames() {
  const syncBtn = document.getElementById('sync-steam-btn');
  const steamBtnText = document.getElementById('steam-btn-text');
  const instructionText = document.getElementById('steam-instruction-text');

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('steam_id, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    const steamId = profile?.steam_id || user.user_metadata?.steam_id;
    if (!steamId) {
      syncBtn?.classList.add('hidden');
      return;
    }

    setActiveSteamId(steamId);
    syncBtn?.classList.remove('hidden');
    if (steamBtnText) {
      steamBtnText.textContent = isRu() ? `Steam привязан (${steamId})` : `Steam Linked (${steamId})`;
    }
    if (instructionText) {
      instructionText.textContent = isRu()
        ? 'Аккаунт Steam подключён. Статистика и игры синхронизируются автоматически.'
        : 'Your Steam account is linked. Games and playtime sync automatically.';
    }

    await loadSteamStatsForId(String(steamId), {
      applyPlayer: !profile?.avatar_url,
      updateOwnAnalytics: true,
    });
  } catch (err) {
    console.error('autoLoadSteamGames error:', err);
  }
}

export async function syncFromSteamProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .maybeSingle();

  const steamId = profile?.steam_id || user.user_metadata?.steam_id;
  if (!steamId) return;

  setActiveSteamId(steamId);
  await loadSteamStatsForId(String(steamId), {
    applyPlayer: true,
    updateOwnAnalytics: true,
  });
}

export function buildDemoData() {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  return {
    response: {
      games: [
        {
          appid: 730,
          name: 'Counter-Strike 2',
          playtime_forever: 94200,
          playtime_2weeks: 1260,
          rtime_last_played: now - day * 1,
          img_icon_url: '8dbc71957312bbd3baea65848b545be9cdd294f4',
        },
        {
          appid: 1245620,
          name: 'ELDEN RING',
          playtime_forever: 28680,
          playtime_2weeks: 420,
          rtime_last_played: now - day * 3,
          img_icon_url: 'b6f29907d8e067c94a36e2c26f14a562135a4397',
        },
        {
          appid: 570,
          name: 'Dota 2',
          playtime_forever: 21420,
          playtime_2weeks: 180,
          rtime_last_played: now - day * 6,
          img_icon_url: '07385eb55b5ba974aebbe74d3c99626eb792d5b7',
        },
        {
          appid: 1091500,
          name: 'Cyberpunk 2077',
          playtime_forever: 9840,
          playtime_2weeks: 0,
          rtime_last_played: now - day * 28,
          img_icon_url: '7a2466355683d9207b924998b7c0ca252f593267',
        },
        {
          appid: 440,
          name: 'Team Fortress 2',
          playtime_forever: 6420,
          playtime_2weeks: 240,
          rtime_last_played: now - day * 9,
          img_icon_url: 'e3f595a92552da3d664ad00277fad2107345f743',
        },
        {
          appid: 1145360,
          name: 'Hades',
          playtime_forever: 3780,
          playtime_2weeks: 0,
          rtime_last_played: now - day * 75,
          img_icon_url: '8f8c4f417c2f3f001d28df3b87bc09a6379f441f',
        },
        {
          appid: 367520,
          name: 'Hollow Knight',
          playtime_forever: 2520,
          playtime_2weeks: 0,
          rtime_last_played: now - day * 120,
          img_icon_url: 'f6368952e7e52256343d32b71c33eb2077b3f98f',
        },
        {
          appid: 105600,
          name: 'Terraria',
          playtime_forever: 1680,
          playtime_2weeks: 0,
          rtime_last_played: now - day * 210,
          img_icon_url: '858961e95ba468736db87615c00b1b3469d3b807',
        },
      ],
    },
  };
}
