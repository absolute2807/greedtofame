import { supabaseClient, STORAGE_KEYS, formatPlaytime, escapeHtml } from './config.js';
import { getLastSteamData } from './steam.js';

const STEAM_ACCOUNTS_STORAGE_KEY = 'greedtofame_linked_steam_accounts_v1';

let activeSteamIdForWishlist = null;
let cachedWishlistItems = [];
let currentGameStatsPayload = null;
let gameStatsViewMode = 'compact'; // 'compact' | 'detailed'
let cachedAllProfiles = [];

const KNOWN_STAT_LABELS = {
  'Stat.InfectedKilled.Total': { en: 'Infected Killed', ru: 'Убито заражённых' },
  'Stat.FinaleFinished.Total': { en: 'Finales Completed', ru: 'Завершено финалов' },
  'Stat.GamesPlayed.Total': { en: 'Matches / Campaigns Played', ru: 'Сыграно игр / кампаний' },
  'Stat.TotalPlayTime.Total': { en: 'In-Game Tracked Time', ru: 'Учтённое время в игре' },
  'Stat.KitsUsed.Total': { en: 'Medkits Used', ru: 'Использовано аптечек' },
  'Stat.KitsShared.Total': { en: 'Medkits Shared', ru: 'Передано аптечек команде' },
  'Stat.PillsUsed.Total': { en: 'Pain Pills Used', ru: 'Принято обезболивающих' },
  'Stat.TeamRevivedMost.Total': { en: 'Most Revived Teammate', ru: 'Больше всего поднятий' },
  'Stat.TeamProtectedMost.Total': { en: 'Most Protected Teammate', ru: 'Больше всего защит союзников' },
  'Stat.WasRevived.Total': { en: 'Times Revived', ru: 'Подняли союзники' },
};

function isRu() {
  return (window.__gtf_lang ? window.__gtf_lang() : localStorage.getItem('greedtofame_lang')) === 'ru';
}

function humanizeStatKey(rawName) {
  const name = String(rawName || '');
  if (KNOWN_STAT_LABELS[name]) {
    return isRu() ? KNOWN_STAT_LABELS[name].ru : KNOWN_STAT_LABELS[name].en;
  }
  const cleaned = name
    .replace(/^Stat\./i, '')
    .replace(/^total_/i, '')
    .replace(/\.Total$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function classifyStatCategory(rawName) {
  const s = String(rawName || '').toLowerCase();
  if (
    s.includes('kill') ||
    s.includes('damage') ||
    s.includes('shot') ||
    s.includes('hit') ||
    s.includes('death') ||
    s.includes('headshot') ||
    s.includes('weapon') ||
    s.includes('infected') ||
    s.includes('zombie') ||
    s.includes('tank') ||
    s.includes('witch')
  ) {
    return 'combat';
  }
  if (
    s.includes('reviv') ||
    s.includes('heal') ||
    s.includes('kit') ||
    s.includes('pill') ||
    s.includes('team') ||
    s.includes('protect') ||
    s.includes('share') ||
    s.includes('assist') ||
    s.includes('mvp')
  ) {
    return 'team';
  }
  if (
    s.includes('win') ||
    s.includes('round') ||
    s.includes('match') ||
    s.includes('game') ||
    s.includes('finale') ||
    s.includes('mission') ||
    s.includes('level') ||
    s.includes('time') ||
    s.includes('score') ||
    s.includes('bomb')
  ) {
    return 'progress';
  }
  return 'other';
}

function getAllGamesList() {
  const steamData = getLastSteamData();
  const games = steamData?.response?.games;
  return Array.isArray(games) ? games : [];
}

function formatLastPlayed(rtime) {
  const ts = Number(rtime) || 0;
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(isRu() ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getSortedAndFilteredGames(searchVal = '', sortVal = 'playtime_desc') {
  const q = String(searchVal || '').trim().toLowerCase();
  const list = getAllGamesList().filter((g) =>
    !q ? true : String(g.name || '').toLowerCase().includes(q)
  );

  list.sort((a, b) => {
    if (sortVal === 'playtime_asc') {
      return (Number(a.playtime_forever) || 0) - (Number(b.playtime_forever) || 0);
    }
    if (sortVal === 'name_asc') {
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (sortVal === 'last_played_desc') {
      return (Number(b.rtime_last_played) || 0) - (Number(a.rtime_last_played) || 0);
    }
    return (Number(b.playtime_forever) || 0) - (Number(a.playtime_forever) || 0);
  });

  return list;
}

// --- ОГРАНИЧЕНИЕ НА 10 ИГР НА ГЛАВНОЙ + МОДАЛКА ВСЕХ ИГР ---
export function enforceTopTenGamesLimit() {
  const tbody = document.getElementById('games-tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr')).filter(
    (tr) => tr.id !== 'steam-placeholder'
  );

  rows.forEach((tr, idx) => {
    tr.style.display = idx >= 10 ? 'none' : '';
  });

  if (
    document.getElementById('all-games-modal') &&
    !document.getElementById('all-games-modal').classList.contains('hidden')
  ) {
    renderAllGamesModal();
  }
}

export function openAllGamesModal() {
  const modal = document.getElementById('all-games-modal');
  const backdrop = document.getElementById('all-games-modal-backdrop');
  const mainSearch = document.getElementById('game-search-input')?.value || '';
  const mainSort = document.getElementById('game-sort-select')?.value || 'playtime_desc';

  const modalSearch = document.getElementById('all-games-search-input');
  const modalSort = document.getElementById('all-games-sort-select');
  if (modalSearch) modalSearch.value = mainSearch;
  if (modalSort) modalSort.value = mainSort;

  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  renderAllGamesModal();
}

export function closeAllGamesModal() {
  document.getElementById('all-games-modal')?.classList.add('hidden');
  document.getElementById('all-games-modal-backdrop')?.classList.add('hidden');
}

export function renderAllGamesModal() {
  const tbody = document.getElementById('all-games-tbody');
  const summaryEl = document.getElementById('all-games-summary');
  if (!tbody) return;

  const q = document.getElementById('all-games-search-input')?.value || '';
  const sort = document.getElementById('all-games-sort-select')?.value || 'playtime_desc';
  const filtered = getSortedAndFilteredGames(q, sort);
  const totalCount = getAllGamesList().length;

  if (summaryEl) {
    summaryEl.textContent = isRu()
      ? `Показано игр: ${filtered.length} из ${totalCount}`
      : `Showing ${filtered.length} of ${totalCount} games`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-xs text-gray-400">${
      isRu() ? 'Игры не найдены.' : 'No games found.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach((g) => {
    const appid = Number(g.appid);
    const hours = Math.round((Number(g.playtime_forever) || 0) / 60);
    const iconUrl = g.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${g.img_icon_url}.jpg`
      : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/capsule_184x69.jpg`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/[0.04] transition cursor-pointer';
    tr.innerHTML = `
      <td class="px-5 py-3.5" data-label="${isRu() ? 'Игра' : 'Game'}">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(g.name || '')}" class="w-8 h-8 rounded object-cover shrink-0 bg-white/5" onerror="this.style.display='none'" />
          <span class="font-bold text-sm text-white truncate">${escapeHtml(g.name || `App ${appid}`)}</span>
        </div>
      </td>
      <td class="px-5 py-3.5 font-mono text-sm font-semibold text-gray-200" data-label="${isRu() ? 'Время' : 'Playtime'}">
        ${escapeHtml(formatPlaytime(hours))}
      </td>
      <td class="px-5 py-3.5 text-xs text-gray-400" data-label="${isRu() ? 'Последний запуск' : 'Last Played'}">
        ${escapeHtml(formatLastPlayed(g.rtime_last_played))}
      </td>
    `;

    tr.addEventListener('click', () => {
      closeAllGamesModal();
      openGameDetailsModal(g);
    });

    tbody.appendChild(tr);
  });
}

// --- УПРАВЛЕНИЕ ПРИВЯЗАННЫМИ STEAM-АККАУНТАМИ ---
function loadLinkedSteamAccounts() {
  try {
    const raw = localStorage.getItem(STEAM_ACCOUNTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function saveLinkedSteamAccounts(list) {
  localStorage.setItem(STEAM_ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
}

async function ensureCurrentSteamInAccounts() {
  const accounts = loadLinkedSteamAccounts();
  let currentId = activeSteamIdForWishlist || '';

  if (!currentId) {
    const { data: { user } } = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('steam_id, username')
        .eq('id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.steam_id) {
        currentId = String(profile.steam_id);
        activeSteamIdForWishlist = currentId;
        if (!accounts.some((a) => String(a.steamId) === currentId)) {
          accounts.unshift({
            steamId: currentId,
            label: profile.username || `Steam ${currentId.slice(-4)}`,
          });
          saveLinkedSteamAccounts(accounts);
        }
      }
    }
  } else if (!accounts.some((a) => String(a.steamId) === String(currentId))) {
    const labelName =
      document.getElementById('profile-username')?.textContent || `Steam ${String(currentId).slice(-4)}`;
    accounts.unshift({ steamId: String(currentId), label: labelName });
    saveLinkedSteamAccounts(accounts);
  }

  return { accounts, activeId: String(currentId || '') };
}

function setSteamAccountsFeedback(msg, isError = false) {
  const el = document.getElementById('steam-accounts-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = `text-xs ${isError ? 'text-red-400' : 'text-green-400'}`;
  el.classList.remove('hidden');
}

export async function openSteamAccountsModal() {
  document.getElementById('auth-dropdown')?.classList.add('hidden');
  const modal = document.getElementById('steam-accounts-modal');
  const backdrop = document.getElementById('steam-accounts-modal-backdrop');
  const fb = document.getElementById('steam-accounts-feedback');
  if (fb) fb.classList.add('hidden');

  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  await renderSteamAccountsModal();
}

export function closeSteamAccountsModal() {
  document.getElementById('steam-accounts-modal')?.classList.add('hidden');
  document.getElementById('steam-accounts-modal-backdrop')?.classList.add('hidden');
}

async function resolveSteamInputToId(rawInput) {
  const val = String(rawInput || '').trim();
  if (/^\d{17}$/.test(val)) return val;

  const matchId = val.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (matchId) return matchId[1];

  let vanity = val;
  const matchVanity = val.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (matchVanity) vanity = matchVanity[1];

  if (!vanity) return '';

  try {
    const { data } = await supabaseClient.functions.invoke('steam-api', {
      body: { vanity },
    });
    const resolved = data?.steamid || data?.response?.steamid || '';
    return /^\d{17}$/.test(String(resolved)) ? String(resolved) : '';
  } catch (_e) {
    return '';
  }
}

async function addSteamAccountHandler() {
  const idInput = document.getElementById('new-steam-id-input');
  const labelInput = document.getElementById('new-steam-label-input');
  const rawVal = idInput?.value || '';
  const customLabel = (labelInput?.value || '').trim();

  if (!rawVal.trim()) {
    setSteamAccountsFeedback(
      isRu() ? 'Введи SteamID64 или ссылку на профиль.' : 'Enter a SteamID64 or Steam profile URL.',
      true
    );
    return;
  }

  setSteamAccountsFeedback(isRu() ? 'Проверяем Steam-аккаунт...' : 'Resolving Steam account...', false);
  const steamId = await resolveSteamInputToId(rawVal);

  if (!/^\d{17}$/.test(steamId)) {
    setSteamAccountsFeedback(
      isRu() ? 'Не удалось определить корректный 17-значный SteamID64.' : 'Could not resolve a valid 17-digit SteamID64.',
      true
    );
    return;
  }

  const accounts = loadLinkedSteamAccounts();
  const existsIdx = accounts.findIndex((a) => String(a.steamId) === steamId);
  const label = customLabel || `Steam (${steamId.slice(-4)})`;

  if (existsIdx >= 0) {
    accounts[existsIdx].label = label;
  } else {
    accounts.push({ steamId, label });
  }
  saveLinkedSteamAccounts(accounts);

  if (idInput) idInput.value = '';
  if (labelInput) labelInput.value = '';

  await switchToSteamAccount(steamId, label, false);
  setSteamAccountsFeedback(
    isRu() ? `Аккаунт ${steamId} добавлен и активирован.` : `Steam account ${steamId} added and activated.`,
    false
  );
}

async function switchToSteamAccount(steamId, label = '', closeAfter = true) {
  const id = String(steamId || '').trim();
  if (!/^\d{17}$/.test(id)) return;

  setActiveWishlistSteamId(id);

  try {
    const { data: { user } } = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      await supabaseClient
        .from('profiles')
        .update({ steam_id: id })
        .eq('id', user.id)
        .catch(() => {});
    }
  } catch (_e) {}

  try {
    await supabaseClient.functions.invoke('steam-api', { body: { steamid: id } });
  } catch (_e) {}

  const syncBtn = document.getElementById('sync-steam-btn');
  if (syncBtn) {
    syncBtn.classList.remove('hidden');
    syncBtn.click();
  }

  if (label) {
    const profName = document.getElementById('profile-username');
    if (profName) profName.textContent = label;
  }

  await renderSteamAccountsModal();
  if (closeAfter) {
    closeSteamAccountsModal();
  }
}

async function removeSteamAccount(steamId) {
  const id = String(steamId || '').trim();
  const filtered = loadLinkedSteamAccounts().filter((a) => String(a.steamId) !== id);
  saveLinkedSteamAccounts(filtered);

  if (String(activeSteamIdForWishlist || '') === id) {
    const next = filtered[0];
    if (next) {
      await switchToSteamAccount(next.steamId, next.label, false);
    } else {
      setActiveWishlistSteamId(null);
      try {
        const { data: { user } } = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } }));
        if (user) {
          await supabaseClient.from('profiles').update({ steam_id: null }).eq('id', user.id).catch(() => {});
        }
      } catch (_e) {}
    }
  }

  await renderSteamAccountsModal();
}

export async function renderSteamAccountsModal() {
  const listEl = document.getElementById('steam-accounts-list');
  if (!listEl) return;

  const { accounts, activeId } = await ensureCurrentSteamInAccounts();
  const ru = isRu();

  if (accounts.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
      ru ? 'Привязанных Steam-аккаунтов пока нет. Добавь первый выше.' : 'No linked Steam accounts yet. Add one above.'
    }</p>`;
    return;
  }

  listEl.innerHTML = '';
  accounts.forEach((acc) => {
    const id = String(acc.steamId);
    const isActive = id === activeId;
    const row = document.createElement('div');
    row.className = `flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
      isActive ? 'bg-white/[0.06] tier-border' : 'bg-white/[0.02] border-white/10'
    }`;

    row.innerHTML = `
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-bold text-white truncate">${escapeHtml(acc.label || id)}</p>
          ${
            isActive
              ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full tier-soft-bg">${
                  ru ? 'АКТИВЕН' : 'ACTIVE'
                }</span>`
              : ''
          }
        </div>
        <p class="text-[11px] font-mono text-gray-400 truncate">${escapeHtml(id)}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${
          !isActive
            ? `<button type="button" class="px-3 py-1.5 text-xs font-bold rounded-lg btn-gradient switch-acc-btn">${
                ru ? 'Переключить' : 'Switch'
              }</button>`
            : ''
        }
        <button type="button" class="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition remove-acc-btn">
          ${ru ? 'Удалить' : 'Remove'}
        </button>
      </div>
    `;

    row.querySelector('.switch-acc-btn')?.addEventListener('click', () => {
      switchToSteamAccount(id, acc.label, true);
    });

    row.querySelector('.remove-acc-btn')?.addEventListener('click', () => {
      removeSteamAccount(id);
    });

    listEl.appendChild(row);
  });
}

export function setActiveWishlistSteamId(steamId) {
  if (activeSteamIdForWishlist !== steamId) {
    activeSteamIdForWishlist = steamId || null;
    cachedWishlistItems = [];
  }
}

export function refreshDynamicTranslations() {
  if (cachedWishlistItems.length > 0) {
    renderWishlistItems();
  }
  if (currentGameStatsPayload) {
    renderGameDetailsStats(currentGameStatsPayload);
  }
  if (cachedAllProfiles.length > 0) {
    renderAllProfilesModal();
  }
  if (
    document.getElementById('all-games-modal') &&
    !document.getElementById('all-games-modal').classList.contains('hidden')
  ) {
    renderAllGamesModal();
  }
  if (
    document.getElementById('steam-accounts-modal') &&
    !document.getElementById('steam-accounts-modal').classList.contains('hidden')
  ) {
    renderSteamAccountsModal();
  }
}

function setGameStatsMode(mode) {
  gameStatsViewMode = mode === 'detailed' ? 'detailed' : 'compact';
  const compactBtn = document.getElementById('gd-mode-compact');
  const detailedBtn = document.getElementById('gd-mode-detailed');

  if (compactBtn && detailedBtn) {
    if (gameStatsViewMode === 'compact') {
      compactBtn.className = 'px-2.5 py-1 rounded-md bg-white/15 text-white transition';
      detailedBtn.className = 'px-2.5 py-1 rounded-md text-gray-400 hover:text-white transition';
    } else {
      detailedBtn.className = 'px-2.5 py-1 rounded-md bg-white/15 text-white transition';
      compactBtn.className = 'px-2.5 py-1 rounded-md text-gray-400 hover:text-white transition';
    }
  }

  if (currentGameStatsPayload) {
    renderGameDetailsStats(currentGameStatsPayload);
  }
}

// --- ДЕТАЛЬНАЯ СТАТИСТИКА ИГРЫ (Пункты 1, 2, 4) ---
export async function openGameDetailsModal(game) {
  if (!game || !game.appid) return;

  const modal = document.getElementById('game-details-modal');
  const backdrop = document.getElementById('game-details-modal-backdrop');
  const bannerEl = document.getElementById('gd-banner');
  const appidEl = document.getElementById('gd-appid');
  const titleEl = document.getElementById('gd-title');
  const storeLinkEl = document.getElementById('gd-store-link');
  const launchLinkEl = document.getElementById('gd-launch-link');
  const liveOnlineEl = document.getElementById('gd-live-online');
  const playtimeEl = document.getElementById('gd-playtime');
  const recentEl = document.getElementById('gd-recent');
  const achEl = document.getElementById('gd-achievements');
  const achBarEl = document.getElementById('gd-achievements-bar');
  const statsBodyEl = document.getElementById('gd-stats-body');
  const rawSearchEl = document.getElementById('gd-raw-search');
  const toggleWrapEl = document.getElementById('gd-view-mode-toggle');

  const appid = Number(game.appid);
  const totalHours = Math.round((Number(game.playtime_forever) || 0) / 60);
  const recentHours = ((Number(game.playtime_2weeks) || 0) / 60).toFixed(1);

  if (bannerEl) {
    bannerEl.style.display = 'block';
    bannerEl.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  }
  if (appidEl) appidEl.textContent = `AppID: ${appid}`;
  if (titleEl) titleEl.textContent = game.name || `App ${appid}`;
  if (storeLinkEl) storeLinkEl.href = `https://store.steampowered.com/app/${appid}`;
  if (launchLinkEl) launchLinkEl.href = `steam://run/${appid}`;
  if (playtimeEl) playtimeEl.textContent = formatPlaytime(totalHours);
  if (recentEl) recentEl.textContent = `${recentHours}h`;
  if (liveOnlineEl) liveOnlineEl.textContent = '...';
  if (achEl) achEl.textContent = '—';
  if (achBarEl) achBarEl.style.width = '0%';
  if (rawSearchEl) {
    rawSearchEl.value = '';
    rawSearchEl.classList.add('hidden');
  }
  if (toggleWrapEl) {
    toggleWrapEl.classList.add('hidden');
  }

  gameStatsViewMode = 'compact';
  setGameStatsMode('compact');
  currentGameStatsPayload = null;

  if (statsBodyEl) {
    statsBodyEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
      isRu() ? 'Загружаем живой онлайн и статистику игрока...' : 'Fetching live player count & in-game stats...'
    }</p>`;
  }

  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');

  let steamId = activeSteamIdForWishlist || '';
  if (!steamId) {
    const { data: { user } } = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('steam_id')
        .eq('id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.steam_id) {
        steamId = String(profile.steam_id);
        activeSteamIdForWishlist = steamId;
      }
    }
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke('steam-game-stats', {
      body: { appid, steamid: steamId },
    });

    if (error || !data) {
      if (liveOnlineEl) liveOnlineEl.textContent = 'N/A';
      if (statsBodyEl) {
        statsBodyEl.innerHTML = `<p class="text-xs text-red-400 py-4 text-center">${
          isRu() ? 'Не удалось получить данные из Steam.' : 'Failed to load game statistics from Steam.'
        }</p>`;
      }
      return;
    }

    currentGameStatsPayload = data;

    if (liveOnlineEl) {
      liveOnlineEl.textContent =
        typeof data.current_players === 'number'
          ? data.current_players.toLocaleString(isRu() ? 'ru-RU' : 'en-US')
          : '—';
    }

    if (achEl) {
      const unlocked = Number(data.achievements?.unlocked) || 0;
      const total = Number(data.achievements?.total) || 0;
      if (total > 0) {
        const effectiveTotal = Math.max(total, unlocked);
        const pct = Math.min(100, Math.round((unlocked / effectiveTotal) * 100));
        achEl.textContent = `${unlocked}/${effectiveTotal} (${pct}%)`;
        if (achBarEl) achBarEl.style.width = `${pct}%`;
      } else if (unlocked > 0) {
        achEl.textContent = `${unlocked}`;
        if (achBarEl) achBarEl.style.width = '100%';
      } else {
        achEl.textContent = '—';
        if (achBarEl) achBarEl.style.width = '0%';
      }
    }

    renderGameDetailsStats(data);
  } catch (err) {
    console.error('Game details error:', err);
    if (liveOnlineEl) liveOnlineEl.textContent = '—';
    if (statsBodyEl) {
      statsBodyEl.innerHTML = `<p class="text-xs text-red-400 py-4 text-center">${
        isRu() ? 'Ошибка при загрузке статистики.' : 'Error loading game stats.'
      }</p>`;
    }
  }
}

function buildTopHighlights(data) {
  const ru = isRu();
  if (Array.isArray(data.highlights) && data.highlights.length > 0) {
    return data.highlights.slice(0, 4).map((h) => ({
      label: ru ? h.ru : h.en,
      value: String(h.value),
    }));
  }

  const rawStats = Array.isArray(data.raw_stats) ? data.raw_stats : [];
  if (rawStats.length === 0) return [];

  const sorted = [...rawStats]
    .filter((s) => typeof Number(s.value) === 'number' && !Number.isNaN(Number(s.value)))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  return sorted.slice(0, 4).map((s) => ({
    label: humanizeStatKey(s.name),
    value: Number(s.value).toLocaleString(ru ? 'ru-RU' : 'en-US'),
  }));
}

function renderGameDetailsStats(data) {
  const statsBodyEl = document.getElementById('gd-stats-body');
  const rawSearchEl = document.getElementById('gd-raw-search');
  const toggleWrapEl = document.getElementById('gd-view-mode-toggle');
  if (!statsBodyEl) return;

  const ru = isRu();
  const rawStats = Array.isArray(data.raw_stats) ? data.raw_stats : [];
  const topHighlights = buildTopHighlights(data);

  if (topHighlights.length === 0 && rawStats.length === 0) {
    rawSearchEl?.classList.add('hidden');
    toggleWrapEl?.classList.add('hidden');
    statsBodyEl.innerHTML = `
      <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
        <p class="text-xs text-gray-400">${
          ru
            ? 'Для этой игры разработчик не отдаёт детальную боевую статистику через GetUserStatsForGame (либо игровой профиль скрыт).'
            : 'Detailed raw stats via GetUserStatsForGame are not exposed for this title (or game details are private).'
        }</p>
      </div>
    `;
    return;
  }

  if (rawStats.length > 0) {
    rawSearchEl?.classList.remove('hidden');
    toggleWrapEl?.classList.remove('hidden');
  } else {
    rawSearchEl?.classList.add('hidden');
    toggleWrapEl?.classList.add('hidden');
  }

  let html = '';

  // Пункт 2: карточки-хайлайты сверху
  if (topHighlights.length > 0) {
    html += `
      <div class="mb-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">${
          ru ? 'Ключевые показатели' : 'Top Highlights'
        }</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          ${topHighlights
            .map(
              (h) => `
              <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <p class="text-[11px] text-gray-400 truncate">${escapeHtml(h.label)}</p>
                <p class="text-base font-extrabold text-white font-mono mt-0.5 truncate">${escapeHtml(h.value)}</p>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // Пункты 1 и 4: группировка по категориям, человекочитаемые названия + мини-бары + Compact/Detailed
  if (rawStats.length > 0) {
    const filterTerm = (rawSearchEl?.value || '').trim().toLowerCase();
    const filteredRaw = filterTerm
      ? rawStats.filter((s) => {
          const rawName = String(s.name || '').toLowerCase();
          const humanName = humanizeStatKey(s.name).toLowerCase();
          return rawName.includes(filterTerm) || humanName.includes(filterTerm);
        })
      : rawStats;

    const groups = {
      combat: {
        title: ru ? 'Бой и урон' : 'Combat & Damage',
        items: [],
      },
      team: {
        title: ru ? 'Команда и поддержка' : 'Team & Support',
        items: [],
      },
      progress: {
        title: ru ? 'Матчи и прогресс' : 'Matches & Progress',
        items: [],
      },
      other: {
        title: ru ? 'Прочие показатели' : 'Other Stats',
        items: [],
      },
    };

    for (const s of filteredRaw) {
      const cat = classifyStatCategory(s.name);
      groups[cat].items.push(s);
    }

    const maxPerGroup = gameStatsViewMode === 'compact' ? 6 : 80;
    const categoryOrder = ['combat', 'team', 'progress', 'other'];

    html += `<div class="space-y-3">`;
    for (const key of categoryOrder) {
      const grp = groups[key];
      if (!grp || grp.items.length === 0) continue;

      const sortedGrp = [...grp.items].sort(
        (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
      );
      const maxVal = Math.max(
        1,
        ...sortedGrp.map((item) => Math.abs(Number(item.value) || 0))
      );
      const visibleItems = sortedGrp.slice(0, maxPerGroup);
      const isOpenDefault = gameStatsViewMode === 'detailed' || Boolean(filterTerm) || key !== 'other';

      html += `
        <details ${isOpenDefault ? 'open' : ''} class="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
          <summary class="flex items-center justify-between text-xs font-bold text-gray-200 cursor-pointer select-none">
            <span>${escapeHtml(grp.title)}</span>
            <span class="text-[11px] font-mono text-gray-400">${visibleItems.length} / ${grp.items.length}</span>
          </summary>
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            ${visibleItems
              .map((s) => {
                const numVal = Number(s.value) || 0;
                const pct = Math.min(100, Math.max(4, Math.round((Math.abs(numVal) / maxVal) * 100)));
                const humanLabel = humanizeStatKey(s.name);
                return `
                  <div class="p-2.5 rounded-lg bg-black/35 border border-white/5 space-y-1.5">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-white truncate">${escapeHtml(humanLabel)}</p>
                        <p class="text-[10px] font-mono text-gray-500 truncate">${escapeHtml(s.name)}</p>
                      </div>
                      <span class="text-xs font-mono font-bold text-white shrink-0">${escapeHtml(
                        numVal.toLocaleString(ru ? 'ru-RU' : 'en-US')
                      )}</span>
                    </div>
                    <div class="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div class="h-full rounded-full btn-gradient opacity-80" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </details>
      `;
    }
    html += `</div>`;
  }

  statsBodyEl.innerHTML = html;
}

export function closeGameDetailsModal() {
  document.getElementById('game-details-modal')?.classList.add('hidden');
  document.getElementById('game-details-modal-backdrop')?.classList.add('hidden');
}

window.__gtf_openGameDetails = openGameDetailsModal;

// --- МОДАЛЬНОЕ ОКНО ВСЕХ ПРОФИЛЕЙ ---
export function openAllProfilesModal() {
  const modal = document.getElementById('all-profiles-modal');
  const backdrop = document.getElementById('all-profiles-modal-backdrop');
  modal?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  loadAllProfilesModal();
}

export function closeAllProfilesModal() {
  document.getElementById('all-profiles-modal')?.classList.add('hidden');
  document.getElementById('all-profiles-modal-backdrop')?.classList.add('hidden');
}

export async function loadAllProfilesModal() {
  const listEl = document.getElementById('all-profiles-list');
  const summaryEl = document.getElementById('all-profiles-summary');
  if (!listEl) return;

  if (summaryEl) {
    summaryEl.textContent = isRu() ? 'Загрузка списка профилей...' : 'Loading community profiles...';
  }
  listEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
    isRu() ? 'Загрузка профилей...' : 'Loading profiles...'
  }</p>`;

  try {
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url, steam_id')
      .order('username', { ascending: true })
      .limit(100);

    if (error) {
      console.error('All profiles modal error:', error);
      if (summaryEl) summaryEl.textContent = isRu() ? 'Ошибка загрузки профилей.' : 'Failed to load profiles.';
      listEl.innerHTML = `<p class="text-xs text-red-400 py-6 text-center">${
        isRu() ? 'Не удалось загрузить профили.' : 'Could not load profiles.'
      }</p>`;
      return;
    }

    cachedAllProfiles = Array.isArray(profiles) ? profiles : [];
    renderAllProfilesModal();
  } catch (err) {
    console.error('All profiles fatal error:', err);
    if (summaryEl) summaryEl.textContent = isRu() ? 'Ошибка загрузки профилей.' : 'Error loading profiles.';
    listEl.innerHTML = `<p class="text-xs text-red-400 py-6 text-center">${
      isRu() ? 'Ошибка при загрузке профилей.' : 'Error loading profiles.'
    }</p>`;
  }
}

export function renderAllProfilesModal() {
  const listEl = document.getElementById('all-profiles-list');
  const summaryEl = document.getElementById('all-profiles-summary');
  const searchEl = document.getElementById('all-profiles-search');
  if (!listEl) return;

  const ru = isRu();
  const q = (searchEl?.value || '').trim().toLowerCase();

  const filtered = q
    ? cachedAllProfiles.filter(
        (p) =>
          String(p.username || '').toLowerCase().includes(q) ||
          String(p.steam_id || '').toLowerCase().includes(q)
      )
    : cachedAllProfiles;

  if (summaryEl) {
    summaryEl.textContent = ru
      ? `Найдено профилей: ${filtered.length} из ${cachedAllProfiles.length}`
      : `Showing ${filtered.length} of ${cachedAllProfiles.length} profiles`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
      ru ? 'Профили не найдены.' : 'No matching profiles found.'
    }</p>`;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach((p) => {
    const name = p.username || 'Player';
    const avatarSrc =
      p.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    const steamStatus = p.steam_id
      ? ru
        ? 'Steam привязан'
        : 'Steam linked'
      : ru
      ? 'Без Steam'
      : 'No Steam';

    const row = document.createElement('div');
    row.className =
      'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition';

    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-bold text-white truncate">${escapeHtml(name)}</p>
          <p class="text-[11px] text-gray-400 truncate">${escapeHtml(steamStatus)}</p>
        </div>
      </div>
      <button type="button" class="px-3 py-1.5 text-xs font-bold rounded-lg border tier-soft-bg hover:brightness-110 transition shrink-0 view-profile-btn">
        ${ru ? 'Открыть →' : 'View →'}
      </button>
    `;

    row.querySelector('.view-profile-btn')?.addEventListener('click', () => {
      closeAllProfilesModal();
      if (typeof window.__gtf_viewCommunityProfile === 'function') {
        window.__gtf_viewCommunityProfile(p);
      }
    });

    listEl.appendChild(row);
  });
}

// --- МОДАЛЬНОЕ ОКНО ЛИДЕРБОРДА ---
export function openLeaderboardModal() {
  document.getElementById('leaderboard-modal')?.classList.remove('hidden');
  document.getElementById('leaderboard-modal-backdrop')?.classList.remove('hidden');
  renderLeaderboard();
}

export function closeLeaderboardModal() {
  document.getElementById('leaderboard-modal')?.classList.add('hidden');
  document.getElementById('leaderboard-modal-backdrop')?.classList.add('hidden');
}

export async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  container.innerHTML = `<p class="text-xs text-gray-400 py-4 text-center">${isRu() ? 'Загрузка таблицы лидеров...' : 'Loading leaderboard...'}</p>`;

  try {
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url, steam_id')
      .limit(20);

    if (error) {
      container.innerHTML = `<p class="text-xs text-red-400 py-4 text-center">${isRu() ? 'Ошибка загрузки профилей.' : 'Failed to load profiles.'}</p>`;
      return;
    }

    if (!Array.isArray(profiles) || profiles.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-500 py-4 text-center">${isRu() ? 'В таблице лидеров пока нет игроков.' : 'No players in leaderboard yet.'}</p>`;
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
          } catch (_err) {}
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

      const gamesWord = isRu() ? 'игр' : 'games';
      const topWord = isRu() ? 'Топ' : 'Top';

      const row = document.createElement('div');
      row.className =
        'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition';
      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-extrabold shrink-0 ${medalClass}">#${rank}</span>
          <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-white truncate">${escapeHtml(name)}</p>
            <p class="text-[11px] text-gray-400 truncate">${topWord}: ${escapeHtml(player.topGameName)} • ${player.gamesCount} ${gamesWord}</p>
          </div>
        </div>
        <span class="text-sm font-mono font-bold tier-text shrink-0">${escapeHtml(formatPlaytime(player.totalHours))}</span>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error('Leaderboard fatal error:', err);
    container.innerHTML = `<p class="text-xs text-red-400 py-4 text-center">${isRu() ? 'Ошибка загрузки лидерборда.' : 'Error loading leaderboard.'}</p>`;
  }
}

// --- РАНДОМАЙЗЕР ---
export function pickRandomGame() {
  const resultEl = document.getElementById('randomizer-result');
  const filterVal = document.getElementById('randomizer-filter')?.value || 'all';
  if (!resultEl) return;

  const games = getAllGamesList();
  if (games.length === 0) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `<p class="text-xs text-gray-400">${
      isRu()
        ? 'Сначала войди через Steam или включи демо-режим.'
        : 'Load or connect a Steam library (or enable Demo) first.'
    }</p>`;
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
          <p class="text-[11px] text-gray-400">${escapeHtml(formatPlaytime(hours))} ${isRu() ? 'наиграно' : 'played'}</p>
        </div>
        <a href="${escapeHtml(launchUrl)}" class="px-3 py-1.5 text-xs font-bold rounded-lg btn-gradient shrink-0">
          ${isRu() ? 'Играть ▶' : 'Launch ▶'}
        </a>
      </div>
    </div>
  `;
}

// --- WISHLIST TRACKER ---
function getDemoWishlistItems() {
  return [
    {
      appid: 1245620,
      name: 'ELDEN RING',
      header_image: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
      discount_percent: 40,
      final_price_formatted: '$35.99',
      initial_price_formatted: '$59.99',
      final_price_cents: 3599,
      is_free: false,
      priority: 1,
    },
    {
      appid: 1091500,
      name: 'Cyberpunk 2077',
      header_image: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg',
      discount_percent: 55,
      final_price_formatted: '$26.99',
      initial_price_formatted: '$59.99',
      final_price_cents: 2699,
      is_free: false,
      priority: 2,
    },
    {
      appid: 2358720,
      name: 'Black Myth: Wukong',
      header_image: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg',
      discount_percent: 0,
      final_price_formatted: '$59.99',
      initial_price_formatted: '',
      final_price_cents: 5999,
      is_free: false,
      priority: 3,
    },
    {
      appid: 1145350,
      name: 'Hades II',
      header_image: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1145350/header.jpg',
      discount_percent: 20,
      final_price_formatted: '$23.99',
      initial_price_formatted: '$29.99',
      final_price_cents: 2399,
      is_free: false,
      priority: 4,
    },
  ];
}

export function openWishlistModal() {
  document.getElementById('wishlist-modal')?.classList.remove('hidden');
  document.getElementById('wishlist-modal-backdrop')?.classList.remove('hidden');

  if (cachedWishlistItems.length > 0) {
    renderWishlistItems();
  } else {
    loadWishlistData();
  }
}

export function closeWishlistModal() {
  document.getElementById('wishlist-modal')?.classList.add('hidden');
  document.getElementById('wishlist-modal-backdrop')?.classList.add('hidden');
}

export async function loadWishlistData() {
  const listEl = document.getElementById('wishlist-items-list');
  const summaryEl = document.getElementById('wishlist-summary');
  if (!listEl) return;

  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true' && !activeSteamIdForWishlist) {
    cachedWishlistItems = getDemoWishlistItems();
    renderWishlistItems();
    return;
  }

  let steamId = activeSteamIdForWishlist;
  if (!steamId) {
    const { data: { user } } = await supabaseClient.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('steam_id')
        .eq('id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null }));
      if (profile?.steam_id) {
        steamId = String(profile.steam_id);
        activeSteamIdForWishlist = steamId;
      }
    }
  }

  if (!steamId) {
    if (summaryEl) {
      summaryEl.textContent = isRu()
        ? 'Войди через Steam, чтобы загрузить свой вишлист.'
        : 'Sign in with Steam to load your public Wishlist.';
    }
    listEl.innerHTML = `<p class="text-xs text-gray-400 py-8 text-center">${
      isRu()
        ? 'Аккаунт Steam не привязан. Войди через Steam или включи демо-режим.'
        : 'No Steam account linked. Sign in with Steam or enable Demo Mode.'
    }</p>`;
    return;
  }

  if (summaryEl) {
    summaryEl.textContent = isRu()
      ? 'Загрузка вишлиста и скидок из Steam Store...'
      : 'Fetching wishlist & Steam Store discounts...';
  }
  listEl.innerHTML = `<p class="text-xs text-gray-400 py-8 text-center">${
    isRu() ? 'Проверяем актуальные цены в Steam...' : 'Loading wishlist prices from Steam Store...'
  }</p>`;

  try {
    const { data, error } = await supabaseClient.functions.invoke('steam-wishlist', {
      body: { steamid: steamId },
    });

    if (error) {
      if (summaryEl) summaryEl.textContent = isRu() ? 'Не удалось загрузить вишлист.' : 'Failed to fetch wishlist.';
      listEl.innerHTML = `<p class="text-xs text-red-400 py-6 text-center">${
        isRu()
          ? 'Не удалось загрузить вишлист. Убедись, что «Доступ к игровой информации» в приватности Steam открыт для всех.'
          : 'Could not load Steam Wishlist. Make sure your Steam Game Details are set to Public.'
      }</p>`;
      return;
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    cachedWishlistItems = items;

    if (items.length === 0) {
      if (summaryEl) {
        summaryEl.textContent = isRu()
          ? 'Вишлист пуст или скрыт настройками приватности.'
          : data?.message || 'Wishlist is empty or private.';
      }
      listEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
        isRu()
          ? 'Игры в вишлисте не найдены. Проверь, что профиль и игровая информация Steam публичны.'
          : 'No wishlist games found. Check that your Steam profile & Game Details are Public.'
      }</p>`;
      return;
    }

    renderWishlistItems();
  } catch (err) {
    console.error('Wishlist load fatal error:', err);
    if (summaryEl) summaryEl.textContent = isRu() ? 'Ошибка загрузки вишлиста.' : 'Error loading wishlist.';
    listEl.innerHTML = `<p class="text-xs text-red-400 py-6 text-center">${
      isRu() ? 'Непредвиденная ошибка при загрузке.' : 'Unexpected error loading wishlist.'
    }</p>`;
  }
}

export function renderWishlistItems() {
  const listEl = document.getElementById('wishlist-items-list');
  const summaryEl = document.getElementById('wishlist-summary');
  const onSaleOnly = Boolean(document.getElementById('wishlist-sale-only')?.checked);
  const sortMode = document.getElementById('wishlist-sort')?.value || 'discount_desc';
  if (!listEl) return;

  const onSaleCount = cachedWishlistItems.filter((i) => (Number(i.discount_percent) || 0) > 0).length;
  if (summaryEl) {
    summaryEl.textContent = isRu()
      ? `Показано игр: ${cachedWishlistItems.length} • Со скидкой сейчас: ${onSaleCount}`
      : `Showing ${cachedWishlistItems.length} games • ${onSaleCount} on sale right now`;
  }

  let filtered = [...cachedWishlistItems];
  if (onSaleOnly) {
    filtered = filtered.filter((i) => (Number(i.discount_percent) || 0) > 0);
  }

  filtered.sort((a, b) => {
    if (sortMode === 'discount_desc') {
      return (Number(b.discount_percent) || 0) - (Number(a.discount_percent) || 0);
    }
    if (sortMode === 'price_asc') {
      const pa = a.is_free ? 0 : Number(a.final_price_cents) || 9999999;
      const pb = b.is_free ? 0 : Number(b.final_price_cents) || 9999999;
      return pa - pb;
    }
    if (sortMode === 'name_asc') {
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    return (Number(a.priority) || 999) - (Number(b.priority) || 999);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
      isRu() ? 'По выбранному фильтру игр не найдено.' : 'No games match the selected filter.'
    }</p>`;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach((item) => {
    const discount = Number(item.discount_percent) || 0;
    const storeUrl = `https://store.steampowered.com/app/${item.appid}`;

    const discountBadge =
      discount > 0
        ? `<span class="px-2 py-0.5 text-xs font-extrabold rounded-md bg-green-500/20 text-green-400 border border-green-500/40">-${discount}%</span>`
        : '';

    const oldPriceHtml =
      discount > 0 && item.initial_price_formatted
        ? `<span class="text-[11px] text-gray-500 line-through">${escapeHtml(item.initial_price_formatted)}</span>`
        : '';

    const card = document.createElement('div');
    card.className =
      'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition';

    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <img src="${escapeHtml(item.header_image)}" alt="${escapeHtml(item.name)}" class="w-24 h-11 rounded-lg object-cover shrink-0 border border-white/10" onerror="this.style.display='none'" />
        <div class="min-w-0">
          <p class="text-sm font-bold text-white truncate">${escapeHtml(item.name)}</p>
          <p class="text-[11px] text-gray-400">AppID: ${escapeHtml(item.appid)}</p>
        </div>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        ${discountBadge}
        <div class="text-right">
          ${oldPriceHtml}
          <p class="text-sm font-mono font-extrabold ${discount > 0 ? 'text-green-400' : 'text-white'}">
            ${escapeHtml(item.final_price_formatted || 'TBA')}
          </p>
        </div>
        <a href="${escapeHtml(storeUrl)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 transition">
          ${isRu() ? 'В Steam ↗' : 'Store ↗'}
        </a>
      </div>
    `;
    listEl.appendChild(card);
  });
}

// --- FLEX CARD ---
export function openFlexCardModal() {
  document.getElementById('flex-card-modal')?.classList.remove('hidden');
  document.getElementById('flex-card-modal-backdrop')?.classList.remove('hidden');
  generateFlexCard();
}

export function closeFlexCardModal() {
  document.getElementById('flex-card-modal')?.classList.add('hidden');
  document.getElementById('flex-card-modal-backdrop')?.classList.add('hidden');
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

  const tierColor =
    getComputedStyle(document.documentElement).getPropertyValue('--tier-color').trim() || '#cbd5e1';

  const w = canvas.width;
  const h = canvas.height;

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#0d0d14');
  bgGrad.addColorStop(0.55, '#151520');
  bgGrad.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.fillStyle = tierColor;
  ctx.font = '800 22px Outfit, sans-serif';
  ctx.fillText('GREEDTOFAME // GAMER CARD', 48, 66);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px Outfit, sans-serif';
  ctx.fillText(username.slice(0, 22), 48, 124);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 20px Outfit, sans-serif';
  ctx.fillText(`${isRu() ? 'Ранг' : 'Tier'}: ${tierText}`, 48, 160);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 16px Outfit, sans-serif';
  ctx.fillText(isRu() ? 'ВСЕГО ЧАСОВ' : 'TOTAL PLAYTIME', 48, 220);
  ctx.fillText(isRu() ? 'ВСЕГО ИГР' : 'TOTAL GAMES', 280, 220);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px Outfit, sans-serif';
  ctx.fillText(totalHoursText, 48, 258);
  ctx.fillText(totalGamesText, 280, 258);

  ctx.fillStyle = tierColor;
  ctx.font = '700 18px Outfit, sans-serif';
  ctx.fillText(isRu() ? 'ТОП-3 ИГРЫ' : 'TOP 3 GAMES', 490, 96);

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
  const gamesTbody = document.getElementById('games-tbody');
  if (gamesTbody) {
    const observer = new MutationObserver(() => {
      enforceTopTenGamesLimit();
    });
    observer.observe(gamesTbody, { childList: true });
    enforceTopTenGamesLimit();
  }

  // Модалка всех игр
  document.getElementById('open-all-games-btn')?.addEventListener('click', openAllGamesModal);
  document.getElementById('close-all-games-btn')?.addEventListener('click', closeAllGamesModal);
  document.getElementById('all-games-modal-backdrop')?.addEventListener('click', closeAllGamesModal);
  document.getElementById('all-games-search-input')?.addEventListener('input', renderAllGamesModal);
  document.getElementById('all-games-sort-select')?.addEventListener('change', renderAllGamesModal);

  // Кнопка Switch Steam Account в выпадающем меню
  document.getElementById('auth-change-account')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    openSteamAccountsModal();
  }, true);

  document.getElementById('close-steam-accounts-btn')?.addEventListener('click', closeSteamAccountsModal);
  document.getElementById('steam-accounts-modal-backdrop')?.addEventListener('click', closeSteamAccountsModal);
  document.getElementById('add-steam-account-btn')?.addEventListener('click', addSteamAccountHandler);

  // Детали игры + Compact/Detailed + поиск
  document.getElementById('close-game-details-btn')?.addEventListener('click', closeGameDetailsModal);
  document.getElementById('game-details-modal-backdrop')?.addEventListener('click', closeGameDetailsModal);
  document.getElementById('gd-mode-compact')?.addEventListener('click', () => setGameStatsMode('compact'));
  document.getElementById('gd-mode-detailed')?.addEventListener('click', () => setGameStatsMode('detailed'));
  document.getElementById('gd-raw-search')?.addEventListener('input', () => {
    if (currentGameStatsPayload) renderGameDetailsStats(currentGameStatsPayload);
  });

  // Все профили
  document.getElementById('view-all-profiles')?.addEventListener('click', openAllProfilesModal);
  document.getElementById('close-all-profiles-btn')?.addEventListener('click', closeAllProfilesModal);
  document.getElementById('all-profiles-modal-backdrop')?.addEventListener('click', closeAllProfilesModal);
  document.getElementById('refresh-all-profiles-btn')?.addEventListener('click', loadAllProfilesModal);
  document.getElementById('all-profiles-search')?.addEventListener('input', renderAllProfilesModal);

  // Лидерборд
  document.getElementById('open-leaderboard-btn')?.addEventListener('click', openLeaderboardModal);
  document.getElementById('close-leaderboard-btn')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('leaderboard-modal-backdrop')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', renderLeaderboard);

  // Рандомайзер
  document.getElementById('randomizer-pick-btn')?.addEventListener('click', pickRandomGame);

  // Вишлист
  document.getElementById('open-wishlist-btn')?.addEventListener('click', openWishlistModal);
  document.getElementById('close-wishlist-btn')?.addEventListener('click', closeWishlistModal);
  document.getElementById('wishlist-modal-backdrop')?.addEventListener('click', closeWishlistModal);
  document.getElementById('refresh-wishlist-btn')?.addEventListener('click', loadWishlistData);
  document.getElementById('wishlist-sale-only')?.addEventListener('change', renderWishlistItems);
  document.getElementById('wishlist-sort')?.addEventListener('change', renderWishlistItems);

  // Flex Card
  document.getElementById('share-profile-btn')?.addEventListener('click', openFlexCardModal);
  document.getElementById('close-flex-card-btn')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-modal-backdrop')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-regenerate-btn')?.addEventListener('click', generateFlexCard);
}
