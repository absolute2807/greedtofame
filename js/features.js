import { supabaseClient, STORAGE_KEYS, formatPlaytime, escapeHtml } from './config.js';
import { getLastSteamData } from './steam.js';

let activeSteamIdForWishlist = null;
let cachedWishlistItems = [];
let currentGameStatsPayload = null;
let gameStatsViewMode = 'compact';
let cachedAllProfiles = [];
let isSyncingSettings = false;

const EXACT_STAT_LABELS_RU = {
  // Rust
  acquired_metal_ore: 'Добыто железной руды',
  acquired_metal_ore_total: 'Добыто железной руды',
  'acquired metal ore': 'Добыто железной руды',
  acquired_stones: 'Добыто камня',
  acquired_wood: 'Добыто дерева',
  acquired_sulfur_ore: 'Добыто серной руды',
  acquired_scrap: 'Собрано металлолома',
  acquired_lowgradefuel: 'Собрано топлива низкого качества',
  calories_consumed: 'Потрачено калорий',
  'calories consumed': 'Потрачено калорий',
  cold_exposure_duration: 'Время на холоде (сек.)',
  'cold exposure duration': 'Время на холоде (сек.)',
  heat_exposure_duration: 'Время на жаре (сек.)',
  comfort_duration: 'Время в комфорте (сек.)',
  inventory_opened: 'Открыто инвентарь',
  'inventory opened': 'Открыто инвентарь',
  map_opened: 'Открыта карта',
  crafting_opened: 'Открыт крафт',
  ore_hit: 'Ударов по руде',
  tree_hit: 'Ударов по деревьям',
  bullet_hit_player: 'Попаданий пулями по игрокам',
  bullet_hit_entity: 'Попаданий пулями по объектам',
  bullet_hit_building: 'Попаданий пулями по постройкам',
  bullet_hit_sign: 'Попаданий по табличкам',
  bullet_hit_bear: 'Попаданий по медведям',
  bullet_hit_boar: 'Попаданий по кабанам',
  bullet_hit_wolf: 'Попаданий по волкам',
  bullet_hit_stag: 'Попаданий по оленям',
  bullet_hit_horse: 'Попаданий по лошадям',
  bullet_hit_chicken: 'Попаданий по курицам',
  bullet_hit_corpse: 'Попаданий по телам',
  bullet_fired: 'Выпущено пуль',
  shotgun_fired: 'Выстрелов из дробовика',
  arrow_fired: 'Выпущено стрел',
  rocket_fired: 'Выпущено ракет',
  wounded_assisted: 'Поднято раненых игроков',
  wounded_healed: 'Вылечено раненых',
  deaths: 'Всего смертей',
  death_suicide: 'Самоубийств',
  death_fall: 'Смертей от падения',
  death_selfinflicted: 'Смертей от своего урона',
  death_entity: 'Смертей от NPC / животных',
  death_player: 'Смертей от игроков',
  kill_player: 'Убито игроков',
  kill_bear: 'Убито медведей',
  kill_boar: 'Убито кабанов',
  kill_wolf: 'Убито волков',
  kill_stag: 'Убито оленей',
  kill_chicken: 'Убито куриц',
  kill_scientist: 'Убито учёных',
  headshot: 'Попаданий в голову',
  items_crafted: 'Скрафчено предметов',
  items_picked_up: 'Подобрано предметов',
  blueprints_studied: 'Изучено чертежей',
  barrels_destroyed: 'Разбито бочек',
  crates_opened: 'Открыто ящиков',
  voice_chat_seconds: 'Время в голосовом чате (сек.)',
  // Left 4 Dead 2
  'stat.infectedkilled.total': 'Убито заражённых',
  'stat.finalefinished.total': 'Завершено финалов',
  'stat.gamesplayed.total': 'Сыграно игр / кампаний',
  'stat.totalplaytime.total': 'Учтённое время в игре',
  'stat.kitsused.total': 'Использовано аптечек',
  'stat.kitsshared.total': 'Передано аптечек команде',
  'stat.pillsused.total': 'Принято обезболивающих',
  'stat.teamrevivedmost.total': 'Поднято союзников (лидер)',
  'stat.teamprotectedmost.total': 'Защищено союзников (лидер)',
  'stat.wasrevived.total': 'Подняли союзники',
  // CS2 / общие
  total_kills: 'Всего убийств',
  total_deaths: 'Всего смертей',
  total_time_played: 'Время в матчах (сек.)',
  total_planted_bombs: 'Установлено бомб',
  total_defused_bombs: 'Обезврежено бомб',
  total_wins: 'Побед в раундах',
  total_damage_done: 'Нанесено урона',
  total_money_earned: 'Заработано денег',
  total_kills_headshot: 'Убийств в голову',
  total_shots_hit: 'Попаданий в цель',
  total_shots_fired: 'Выстрелов сделано',
  total_rounds_played: 'Сыграно раундов',
  total_mvps: 'Звёзд СЦП (MVP)',
  total_matches_won: 'Выиграно матчей',
  total_matches_played: 'Сыграно матчей',
};

const PHRASE_REPLACEMENTS_RU = [
  [/\bbullet hit\b/gi, 'попаданий пулями по:'],
  [/\barrow hit\b/gi, 'попаданий стрелами по:'],
  [/\bmelee hit\b/gi, 'ударов в ближнем бою по:'],
  [/\bshotgun fired\b/gi, 'выстрелов из дробовика'],
  [/\bbullet fired\b/gi, 'выпущено пуль'],
  [/\barrow fired\b/gi, 'выпущено стрел'],
  [/\brocket fired\b/gi, 'выпущено ракет'],
  [/\bwounded assisted\b/gi, 'помощи раненым'],
  [/\bwounded healed\b/gi, 'лечений раненых'],
  [/\bacquired\b/gi, 'добыто / получено:'],
  [/\bconsumed\b/gi, 'использовано:'],
  [/\bexposure duration\b/gi, 'длительность воздействия:'],
  [/\bduration\b/gi, 'длительность:'],
  [/\bopened\b/gi, 'открыто:'],
  [/\bdestroyed\b/gi, 'уничтожено:'],
  [/\bcrafted\b/gi, 'скрафчено:'],
  [/\bkilled\b/gi, 'убито:'],
  [/\bkills\b/gi, 'убийств:'],
  [/\bdeaths\b/gi, 'смертей:'],
  [/\bheadshots?\b/gi, 'в голову'],
  [/\baccuracy\b/gi, 'точность'],
  [/\bdamage\b/gi, 'урон'],
  [/\bwins?\b/gi, 'побед'],
  [/\bplayed\b/gi, 'сыграно'],
  [/\bplayer\b/gi, 'игрокам'],
  [/\bentity\b/gi, 'объектам / NPC'],
  [/\bbuilding\b/gi, 'постройкам'],
  [/\bmetal ore\b/gi, 'железной руды'],
  [/\bsulfur ore\b/gi, 'серной руды'],
  [/\bstones?\b/gi, 'камня'],
  [/\bwood\b/gi, 'дерева'],
  [/\bscrap\b/gi, 'металлолома'],
  [/\bcalories\b/gi, 'калорий'],
  [/\bcold\b/gi, 'холод'],
  [/\bheat\b/gi, 'жара'],
  [/\binventory\b/gi, 'инвентарь'],
  [/\bore hit\b/gi, 'ударов по руде'],
  [/\btree hit\b/gi, 'ударов по деревьям'],
];

function isRu() {
  return (window.__gtf_lang ? window.__gtf_lang() : localStorage.getItem('greedtofame_lang')) === 'ru';
}

function humanizeStatKeyEn(rawName) {
  const name = String(rawName || '');
  const cleaned = name
    .replace(/^Stat\./i, '')
    .replace(/^total_/i, '')
    .replace(/\.Total$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function translateStatToRu(rawName) {
  const raw = String(rawName || '').trim();
  const lower = raw.toLowerCase();
  if (EXACT_STAT_LABELS_RU[lower]) return EXACT_STAT_LABELS_RU[lower];

  const enHuman = humanizeStatKeyEn(raw);
  const enLower = enHuman.toLowerCase();
  if (EXACT_STAT_LABELS_RU[enLower]) return EXACT_STAT_LABELS_RU[enLower];

  let translated = enHuman;
  let matched = false;
  for (const [regex, ruPart] of PHRASE_REPLACEMENTS_RU) {
    if (regex.test(translated)) {
      translated = translated.replace(regex, ruPart);
      matched = true;
    }
  }

  if (matched) {
    translated = translated.replace(/\s+/g, ' ').replace(/:\s*$/g, '').trim();
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return enHuman;
}

function getStatDisplayLabel(rawName) {
  return isRu() ? translateStatToRu(rawName) : humanizeStatKeyEn(rawName);
}

function enforceSteamLinkedNonClickable() {
  const btn = document.getElementById('connect-steam-btn');
  const textEl = document.getElementById('steam-btn-text');
  if (!btn || !textEl) return;

  const txt = String(textEl.textContent || '').trim().toLowerCase();
  const isLinked =
    txt.includes('steam linked') ||
    txt.includes('steam привязан') ||
    txt.includes('привязан (');

  if (isLinked) {
    btn.removeAttribute('href');
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('tabindex', '-1');
    btn.classList.add('pointer-events-none', 'select-none', 'opacity-85', 'cursor-default');
    btn.classList.remove('hover:-translate-y-0.5', 'cursor-pointer');
  } else {
    if (!btn.getAttribute('href')) {
      btn.setAttribute(
        'href',
        'https://tcdtdftgpdjmrpqoltlg.supabase.co/functions/v1/steam-auth-callback'
      );
    }
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('tabindex');
    btn.classList.remove('pointer-events-none', 'select-none', 'opacity-85', 'cursor-default');
    btn.classList.add('hover:-translate-y-0.5');
  }
}

function syncSettingsButtonsVisualStyle() {
  if (isSyncingSettings) return;
  isSyncingSettings = true;

  try {
    const ids = [
      'format-hours',
      'format-days',
      'theme-dark',
      'theme-light',
      'lang-en',
      'lang-ru',
    ];

    const isLightTheme =
      document.body.classList.contains('light-theme') ||
      document.documentElement.classList.contains('light-theme');

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const isSelected =
        el.classList.contains('border-purple-500') ||
        el.classList.contains('bg-purple-500/10') ||
        el.classList.contains('text-purple-400') ||
        el.classList.contains('btn-gradient') ||
        el.getAttribute('aria-pressed') === 'true';

      el.classList.remove(
        'border-purple-500',
        'bg-purple-500/10',
        'text-purple-400',
        'border-white/10',
        'text-gray-400',
        'hover:bg-white/5'
      );

      if (isSelected) {
        el.classList.add('btn-gradient', 'border-transparent', 'shadow-md');
      } else {
        el.classList.add(
          'border-transparent',
          isLightTheme ? 'text-slate-600' : 'text-gray-400',
          'hover:text-white',
          'hover:bg-white/5'
        );
      }
    });
  } finally {
    isSyncingSettings = false;
  }
}

function getAllGamesList() {
  const steamData = getLastSteamData();
  const games = steamData?.response?.games;
  return Array.isArray(games) ? games : [];
}

export function setActiveWishlistSteamId(steamId) {
  if (activeSteamIdForWishlist !== steamId) {
    activeSteamIdForWishlist = steamId || null;
    cachedWishlistItems = [];
  }
}

export function refreshDynamicTranslations() {
  syncSettingsButtonsVisualStyle();
  enforceSteamLinkedNonClickable();

  if (cachedWishlistItems.length > 0) renderWishlistItems();
  if (currentGameStatsPayload) renderGameDetailsStats(currentGameStatsPayload);
  if (cachedAllProfiles.length > 0) renderAllProfilesModal();
}

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

  currentGameStatsPayload = null;
  if (statsBodyEl) {
    statsBodyEl.innerHTML = `<p class="text-xs text-gray-400 py-6 text-center">${
      isRu() ? 'Загружаем статистику из Steam...' : 'Fetching live player count & in-game stats...'
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
          isRu() ? 'Не удалось получить статистику из Steam.' : 'Failed to load game statistics from Steam.'
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
      }
    }

    renderGameDetailsStats(data);
  } catch (err) {
    console.error('Game details error:', err);
    if (statsBodyEl) {
      statsBodyEl.innerHTML = `<p class="text-xs text-red-400 py-4 text-center">${
        isRu() ? 'Ошибка при загрузке статистики.' : 'Error loading game stats.'
      }</p>`;
    }
  }
}

function renderGameDetailsStats(data) {
  const statsBodyEl = document.getElementById('gd-stats-body');
  const rawSearchEl = document.getElementById('gd-raw-search');
  if (!statsBodyEl) return;

  const ru = isRu();
  const rawStats = Array.isArray(data.raw_stats) ? data.raw_stats : [];

  if (rawStats.length > 0) {
    rawSearchEl?.classList.remove('hidden');
    if (rawSearchEl) {
      rawSearchEl.placeholder = ru ? 'Поиск по показателям...' : 'Filter stats...';
    }
  } else {
    rawSearchEl?.classList.add('hidden');
  }

  const filterTerm = (rawSearchEl?.value || '').trim().toLowerCase();
  const filteredRaw = filterTerm
    ? rawStats.filter((s) => {
        const rawName = String(s.name || '').toLowerCase();
        const enName = humanizeStatKeyEn(s.name).toLowerCase();
        const ruName = translateStatToRu(s.name).toLowerCase();
        return rawName.includes(filterTerm) || enName.includes(filterTerm) || ruName.includes(filterTerm);
      })
    : rawStats;

  if (filteredRaw.length === 0) {
    statsBodyEl.innerHTML = `<p class="text-xs text-gray-400 py-4 text-center">${
      ru ? 'Нет показателей для отображения.' : 'No stats available for this game.'
    }</p>`;
    return;
  }

  const limit = gameStatsViewMode === 'compact' ? 24 : 120;
  statsBodyEl.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">${filteredRaw
    .slice(0, limit)
    .map((s) => {
      const label = getStatDisplayLabel(s.name);
      const val = Number(s.value);
      const formattedVal = Number.isFinite(val) ? val.toLocaleString(ru ? 'ru-RU' : 'en-US') : String(s.value ?? '—');
      return `
        <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-bold text-white truncate" title="${escapeHtml(label)}">${escapeHtml(label)}</p>
            <p class="text-[10px] font-mono text-gray-500 truncate">${escapeHtml(s.name)}</p>
          </div>
          <span class="text-xs font-mono font-bold text-white shrink-0">${escapeHtml(formattedVal)}</span>
        </div>
      `;
    })
    .join('')}</div>`;
}

export function closeGameDetailsModal() {
  document.getElementById('game-details-modal')?.classList.add('hidden');
  document.getElementById('game-details-modal-backdrop')?.classList.add('hidden');
}

window.__gtf_openGameDetails = openGameDetailsModal;

export function openAllProfilesModal() {
  document.getElementById('all-profiles-modal')?.classList.remove('hidden');
  document.getElementById('all-profiles-modal-backdrop')?.classList.remove('hidden');
  loadAllProfilesModal();
}

export function closeAllProfilesModal() {
  document.getElementById('all-profiles-modal')?.classList.add('hidden');
  document.getElementById('all-profiles-modal-backdrop')?.classList.add('hidden');
}

export async function loadAllProfilesModal() {
  const listEl = document.getElementById('all-profiles-list');
  if (!listEl) return;

  try {
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url, steam_id')
      .order('username', { ascending: true })
      .limit(100);

    cachedAllProfiles = Array.isArray(profiles) ? profiles : [];
    renderAllProfilesModal();
  } catch (err) {
    console.error('All profiles error:', err);
  }
}

export function renderAllProfilesModal() {
  const listEl = document.getElementById('all-profiles-list');
  const searchEl = document.getElementById('all-profiles-search');
  if (!listEl) return;

  const ru = isRu();
  const q = (searchEl?.value || '').trim().toLowerCase();
  const filtered = q
    ? cachedAllProfiles.filter((p) => String(p.username || '').toLowerCase().includes(q))
    : cachedAllProfiles;

  listEl.innerHTML = '';
  filtered.forEach((p) => {
    const name = p.username || 'Player';
    const avatarSrc =
      p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10';
    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-10 h-10 rounded-full object-cover shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-bold text-white truncate">${escapeHtml(name)}</p>
          <p class="text-[11px] text-gray-400 truncate">${p.steam_id ? (ru ? 'Steam привязан' : 'Steam linked') : (ru ? 'Без Steam' : 'No Steam')}</p>
        </div>
      </div>
      <button type="button" class="px-3 py-1.5 text-xs font-bold rounded-lg border tier-soft-bg view-profile-btn">${ru ? 'Открыть →' : 'View →'}</button>
    `;
    row.querySelector('.view-profile-btn')?.addEventListener('click', () => {
      closeAllProfilesModal();
      if (typeof window.__gtf_viewCommunityProfile === 'function') window.__gtf_viewCommunityProfile(p);
    });
    listEl.appendChild(row);
  });
}

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
  try {
    const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url, steam_id').limit(20);
    if (!Array.isArray(profiles) || profiles.length === 0) return;

    const enriched = await Promise.all(
      profiles.map(async (p) => {
        let totalHours = 0;
        let gamesCount = 0;
        if (p.steam_id) {
          try {
            const { data } = await supabaseClient.functions.invoke('steam-api', { body: { steamid: String(p.steam_id) } });
            const list = data?.games?.games ?? data?.response?.games ?? [];
            if (Array.isArray(list)) {
              gamesCount = list.length;
              totalHours = Math.round(list.reduce((acc, g) => acc + (Number(g.playtime_forever) || 0), 0) / 60);
            }
          } catch (_e) {}
        }
        return { ...p, totalHours, gamesCount };
      })
    );

    enriched.sort((a, b) => b.totalHours - a.totalHours);
    container.innerHTML = '';
    enriched.forEach((player, idx) => {
      const name = player.username || 'Player';
      const avatarSrc = player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5';
      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs font-extrabold">#${idx + 1}</span>
          <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-9 h-9 rounded-full object-cover shrink-0" />
          <p class="text-sm font-bold text-white truncate">${escapeHtml(name)}</p>
        </div>
        <span class="text-sm font-mono font-bold tier-text shrink-0">${escapeHtml(formatPlaytime(player.totalHours))}</span>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

export function pickRandomGame() {
  const resultEl = document.getElementById('randomizer-result');
  const games = getAllGamesList();
  if (!resultEl || games.length === 0) return;
  const picked = games[Math.floor(Math.random() * games.length)];
  const hours = Math.round((Number(picked.playtime_forever) || 0) / 60);
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-xs font-bold text-white truncate">${escapeHtml(picked.name)}</p>
        <p class="text-[11px] text-gray-400">${escapeHtml(formatPlaytime(hours))}</p>
      </div>
      <a href="steam://run/${picked.appid}" class="px-3 py-1.5 text-xs font-bold rounded-lg btn-gradient shrink-0">${isRu() ? 'Играть ▶' : 'Launch ▶'}</a>
    </div>
  `;
}

export function openWishlistModal() {
  document.getElementById('wishlist-modal')?.classList.remove('hidden');
  document.getElementById('wishlist-modal-backdrop')?.classList.remove('hidden');
  if (cachedWishlistItems.length > 0) renderWishlistItems();
  else loadWishlistData();
}

export function closeWishlistModal() {
  document.getElementById('wishlist-modal')?.classList.add('hidden');
  document.getElementById('wishlist-modal-backdrop')?.classList.add('hidden');
}

export async function loadWishlistData() {
  const listEl = document.getElementById('wishlist-items-list');
  if (!listEl) return;
  let steamId = activeSteamIdForWishlist;
  if (!steamId && localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
    cachedWishlistItems = [];
    renderWishlistItems();
    return;
  }
  if (!steamId) return;
  try {
    const { data } = await supabaseClient.functions.invoke('steam-wishlist', { body: { steamid: steamId } });
    cachedWishlistItems = Array.isArray(data?.items) ? data.items : [];
    renderWishlistItems();
  } catch (err) {
    console.error('Wishlist error:', err);
  }
}

export function renderWishlistItems() {
  const listEl = document.getElementById('wishlist-items-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  cachedWishlistItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5';
    card.innerHTML = `
      <div class="min-w-0">
        <p class="text-sm font-bold text-white truncate">${escapeHtml(item.name)}</p>
        <p class="text-[11px] text-gray-400">${escapeHtml(item.final_price_formatted || '')}</p>
      </div>
      <a href="https://store.steampowered.com/app/${item.appid}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10">${isRu() ? 'В Steam ↗' : 'Store ↗'}</a>
    `;
    listEl.appendChild(card);
  });
}

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
  const totalHours = document.getElementById('stat-total-hours')?.textContent || '0h';

  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 42px Outfit, sans-serif';
  ctx.fillText(username, 48, 120);
  ctx.font = '700 28px Outfit, sans-serif';
  ctx.fillText(totalHours, 48, 180);

  if (downloadLink) {
    downloadLink.href = canvas.toDataURL('image/png');
  }
}

export function initFeatures() {
  const steamBtnText = document.getElementById('steam-btn-text');
  if (steamBtnText) {
    const steamBtnObserver = new MutationObserver(() => enforceSteamLinkedNonClickable());
    steamBtnObserver.observe(steamBtnText, { childList: true, characterData: true, subtree: true });
    enforceSteamLinkedNonClickable();
  }

  syncSettingsButtonsVisualStyle();

  ['format-hours', 'format-days', 'theme-dark', 'theme-light', 'lang-en', 'lang-ru'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      setTimeout(() => {
        syncSettingsButtonsVisualStyle();
        refreshDynamicTranslations();
      }, 0);
    });
  });

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    setTimeout(syncSettingsButtonsVisualStyle, 0);
  });

  document.getElementById('close-game-details-btn')?.addEventListener('click', closeGameDetailsModal);
  document.getElementById('game-details-modal-backdrop')?.addEventListener('click', closeGameDetailsModal);
  document.getElementById('gd-mode-compact')?.addEventListener('click', () => {
    gameStatsViewMode = 'compact';
    if (currentGameStatsPayload) renderGameDetailsStats(currentGameStatsPayload);
  });
  document.getElementById('gd-mode-detailed')?.addEventListener('click', () => {
    gameStatsViewMode = 'detailed';
    if (currentGameStatsPayload) renderGameDetailsStats(currentGameStatsPayload);
  });
  document.getElementById('gd-raw-search')?.addEventListener('input', () => {
    if (currentGameStatsPayload) renderGameDetailsStats(currentGameStatsPayload);
  });

  document.getElementById('view-all-profiles')?.addEventListener('click', openAllProfilesModal);
  document.getElementById('close-all-profiles-btn')?.addEventListener('click', closeAllProfilesModal);
  document.getElementById('all-profiles-modal-backdrop')?.addEventListener('click', closeAllProfilesModal);
  document.getElementById('refresh-all-profiles-btn')?.addEventListener('click', loadAllProfilesModal);
  document.getElementById('all-profiles-search')?.addEventListener('input', renderAllProfilesModal);

  document.getElementById('open-leaderboard-btn')?.addEventListener('click', openLeaderboardModal);
  document.getElementById('close-leaderboard-btn')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('leaderboard-modal-backdrop')?.addEventListener('click', closeLeaderboardModal);
  document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', renderLeaderboard);

  document.getElementById('randomizer-pick-btn')?.addEventListener('click', pickRandomGame);

  document.getElementById('open-wishlist-btn')?.addEventListener('click', openWishlistModal);
  document.getElementById('close-wishlist-btn')?.addEventListener('click', closeWishlistModal);
  document.getElementById('wishlist-modal-backdrop')?.addEventListener('click', closeWishlistModal);
  document.getElementById('refresh-wishlist-btn')?.addEventListener('click', loadWishlistData);

  document.getElementById('share-profile-btn')?.addEventListener('click', openFlexCardModal);
  document.getElementById('close-flex-card-btn')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-modal-backdrop')?.addEventListener('click', closeFlexCardModal);
  document.getElementById('flex-card-regenerate-btn')?.addEventListener('click', generateFlexCard);
}
