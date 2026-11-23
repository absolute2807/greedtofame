import { supabaseClient, STORAGE_KEYS, prefs, setPref, escapeHtml } from './config.js';
import {
  renderSteamGames,
  renderFilteredGamesTable,
  autoLoadSteamGames,
  loadSteamStatsForId,
  syncFromSteamProfile,
  buildDemoData,
  getLastSteamData,
  toggleEmptyStates,
} from './steam.js';
import { updateAnalytics } from './analytics.js';
import { initFeatures, setActiveWishlistSteamId, refreshDynamicTranslations } from './features.js';

const STEAM_AUTH_URL = 'https://tcdtdftgpdjmrpqoltlg.supabase.co/functions/v1/steam-auth-callback';
const LANG_STORAGE_KEY = 'greedtofame_lang';

const TRANSLATIONS = {
  en: {
    demo_badge: 'DEMO MODE',
    sign_in_steam: 'Sign in with Steam',
    switch_steam: 'Switch Steam Account',
    logout: 'Logout',
    click_game_hint: 'Click any game to view live online & in-game stats',
    gd_store: 'Steam Store ↗',
    gd_launch: 'Launch ▶',
    gd_online_now: 'Online Right Now',
    gd_your_playtime: 'Your Playtime',
    gd_recent_2w: 'Last 2 Weeks',
    gd_achievements: 'Achievements',
    gd_ingame_stats: 'In-Game Statistics',
    gd_search_stat: 'Filter raw stat keys...',
    wishlist_modal_title: 'Wishlist & Discount Tracker',
    wishlist_modal_sub: 'Public Steam Wishlist with live store discounts.',
    refresh: 'Refresh',
    on_sale_only: 'On Sale Only (Discounts)',
    sort_discount: 'Discount: Highest First',
    sort_price: 'Price: Low → High',
    sort_priority: 'Wishlist Priority',
    sort_name: 'Name: A → Z',
    leaderboard_title: 'Leaderboard',
    leaderboard_sub: 'Top players ranked by total Steam playtime.',
    flex_card_title: 'Your Flex Card',
    flex_card_sub: 'Download your PNG gamer card and share it anywhere.',
    redraw_card: 'Redraw Card',
    download_png: 'Download PNG',
    settings_title: 'Settings',
    time_format: 'Time Format',
    hours: 'Hours',
    days: 'Days',
    appearance: 'Appearance',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    edit_profile_title: 'Edit Profile',
    upload_avatar: 'Upload Avatar',
    username_label: 'Username',
    username_placeholder: 'Enter new username',
    save: 'Save',
    cancel: 'Cancel',
    welcome_back: 'Welcome back,',
    welcome_sub: "Here's what you've been playing lately.",
    try_demo: 'Try demo profile',
    exit_demo: 'Exit demo profile',
    try_demo_short: 'Try demo',
    flex_card_btn: 'Flex Card',
    edit_profile_btn: 'Edit Profile',
    settings_btn: 'Settings',
    player_profile: 'Player Profile',
    steam_account: 'Steam Account',
    sync_steam: 'Sync from Steam',
    syncing: 'Syncing...',
    synced: 'Synced!',
    sync_failed: 'Sync failed',
    steam_instruction: 'One-click login via Steam. Your games and playtime load automatically.',
    loading_steam: 'Loading Steam games...',
    member_since: 'Member since',
    total_games: 'Total games',
    total_hours: 'Total hours',
    back_my_profile: '← Back to My Profile',
    community: 'Community',
    leaderboard_btn: 'Leaderboard 🏆',
    search_players: 'Search players...',
    view_all_profiles: 'View All Profiles',
    randomizer_title: 'What to play tonight?',
    randomizer_sub: 'Pick a random game from your library.',
    filter_all: 'All Games',
    filter_unplayed: 'Never Played (0h)',
    filter_dusty: 'Not Played > 1 Year',
    filter_light: 'Short Sessions (≤ 15h)',
    pick_random_btn: 'Pick Random Game 🎲',
    wishlist_card_title: 'Wishlist & Sales',
    wishlist_card_sub: 'Track prices and discounts from your public Steam Wishlist.',
    open_wishlist_btn: 'Open Wishlist Tracker 🏷️',
    hours_played: 'Hours Played',
    playstyle: 'Playstyle',
    top_game: 'Top Game',
    no_games_yet: 'No games yet',
    hall_of_fame: 'Hall of Fame',
    hall_of_fame_sub: 'Your top 3 most played games.',
    podium_empty_title: 'Your Hall of Fame is empty.',
    podium_empty_sub: 'Sign in with Steam or try the demo to see your top 3 games.',
    your_games: 'Your Games',
    analytics_btn: 'Analytics ↗',
    search_game: 'Search game...',
    sort_hours_desc: 'Hours: High → Low',
    sort_hours_asc: 'Hours: Low → High',
    sort_name_asc: 'Name: A → Z',
    sort_last_played: 'Last Played',
    library_hidden_title: 'Library is hidden for privacy.',
    library_hidden_sub: 'Click the eye icon to reveal.',
    col_game: 'Game',
    col_playtime: 'Playtime',
    col_last_played: 'Last Played',
    table_placeholder: 'Sign in with Steam to see your games',
    analytics_title: 'Advanced Analytics',
    analytics_sub: 'Deep dive into your gaming habits.',
    back_dashboard: 'Back to Dashboard',
    top10_chart: 'Top 10 Games by Hours',
    recent_chart: 'Recent Activity (2 Weeks)',
    fun_facts: 'Fun Facts',
    avg_playtime: 'Average Playtime / Game',
    most_played_game: 'Most Played Game',
    total_games_lib: 'Total Games in Library',
    library_value: 'Library Value',
    library_value_sub: 'Estimated based on real Steam Store prices.',
    library_value_note: '*Real-time Steam Store prices (F2P games = $0)',
  },
  ru: {
    demo_badge: 'ДЕМО-РЕЖИМ',
    sign_in_steam: 'Войти через Steam',
    switch_steam: 'Сменить аккаунт Steam',
    logout: 'Выйти',
    click_game_hint: 'Нажми на любую игру, чтобы увидеть онлайн и статистику',
    gd_store: 'В Steam ↗',
    gd_launch: 'Играть ▶',
    gd_online_now: 'Онлайн прямо сейчас',
    gd_your_playtime: 'Твоё время в игре',
    gd_recent_2w: 'За 2 недели',
    gd_achievements: 'Достижения',
    gd_ingame_stats: 'Внутриигровая статистика',
    gd_search_stat: 'Поиск по параметрам...',
    wishlist_modal_title: 'Список желаемого и скидки',
    wishlist_modal_sub: 'Публичный вишлист Steam с актуальными ценами и скидками.',
    refresh: 'Обновить',
    on_sale_only: 'Только со скидкой',
    sort_discount: 'Скидка: сначала больше',
    sort_price: 'Цена: по возрастанию',
    sort_priority: 'По приоритету вишлиста',
    sort_name: 'Название: А → Я',
    leaderboard_title: 'Таблица лидеров',
    leaderboard_sub: 'Топ игроков по общему количеству часов в Steam.',
    flex_card_title: 'Твоя Flex-карточка',
    flex_card_sub: 'Скачай PNG-карточку игрока и поделись с друзьями.',
    redraw_card: 'Перерисовать',
    download_png: 'Скачать PNG',
    settings_title: 'Настройки',
    time_format: 'Формат времени',
    hours: 'Часы',
    days: 'Дни',
    appearance: 'Оформление',
    dark: 'Тёмная',
    light: 'Светлая',
    language: 'Язык',
    edit_profile_title: 'Редактировать профиль',
    upload_avatar: 'Загрузить аватар',
    username_label: 'Никнейм',
    username_placeholder: 'Введите новый никнейм',
    save: 'Сохранить',
    cancel: 'Отмена',
    welcome_back: 'С возвращением,',
    welcome_sub: 'Вот во что ты играл в последнее время.',
    try_demo: 'Демо-профиль',
    exit_demo: 'Выйти из демо',
    try_demo_short: 'Демо',
    flex_card_btn: 'Flex-карта',
    edit_profile_btn: 'Профиль',
    settings_btn: 'Настройки',
    player_profile: 'Профиль игрока',
    steam_account: 'Аккаунт Steam',
    sync_steam: 'Обновить из Steam',
    syncing: 'Синхронизация...',
    synced: 'Обновлено!',
    sync_failed: 'Ошибка синхронизации',
    steam_instruction: 'Вход в один клик через Steam. Игры и часы загрузятся автоматически.',
    loading_steam: 'Загрузка игр Steam...',
    member_since: 'На сайте с',
    total_games: 'Всего игр',
    total_hours: 'Всего часов',
    back_my_profile: '← Вернуться в мой профиль',
    community: 'Сообщество',
    leaderboard_btn: 'Лидерборд 🏆',
    search_players: 'Поиск игроков...',
    view_all_profiles: 'Все профили',
    randomizer_title: 'Во что поиграть сегодня?',
    randomizer_sub: 'Случайная игра из твоей библиотеки.',
    filter_all: 'Все игры',
    filter_unplayed: 'Ни разу не запускал (0ч)',
    filter_dusty: 'Не играл > 1 года',
    filter_light: 'Короткие сессии (≤ 15ч)',
    pick_random_btn: 'Выбрать случайную игру 🎲',
    wishlist_card_title: 'Вишлист и скидки',
    wishlist_card_sub: 'Отслеживай цены и скидки из публичного вишлиста Steam.',
    open_wishlist_btn: 'Открыть трекер вишлиста 🏷️',
    hours_played: 'Наиграно часов',
    playstyle: 'Стиль игры',
    top_game: 'Любимая игра',
    no_games_yet: 'Пока нет игр',
    hall_of_fame: 'Зал славы',
    hall_of_fame_sub: 'Твои топ-3 игры по наигранным часам.',
    podium_empty_title: 'Зал славы пока пуст.',
    podium_empty_sub: 'Войди через Steam или включи демо, чтобы увидеть топ-3 игры.',
    your_games: 'Твои игры',
    analytics_btn: 'Аналитика ↗',
    search_game: 'Поиск игры...',
    sort_hours_desc: 'Часы: больше → меньше',
    sort_hours_asc: 'Часы: меньше → больше',
    sort_name_asc: 'Название: А → Я',
    sort_last_played: 'Последний запуск',
    library_hidden_title: 'Библиотека скрыта для приватности.',
    library_hidden_sub: 'Нажми на иконку глаза, чтобы показать.',
    col_game: 'Игра',
    col_playtime: 'Время в игре',
    col_last_played: 'Последний запуск',
    table_placeholder: 'Войди через Steam, чтобы увидеть свои игры',
    analytics_title: 'Расширенная аналитика',
    analytics_sub: 'Подробный разбор твоих игровых привычек.',
    back_dashboard: 'Назад в дашборд',
    top10_chart: 'Топ-10 игр по часам',
    recent_chart: 'Активность за 2 недели',
    fun_facts: 'Интересные факты',
    avg_playtime: 'Среднее время на игру',
    most_played_game: 'Самая популярная игра',
    total_games_lib: 'Всего игр в библиотеке',
    library_value: 'Стоимость библиотеки',
    library_value_sub: 'Оценка по актуальным ценам Steam Store.',
    library_value_note: '*Актуальные цены Steam Store (бесплатные игры = $0)',
  },
};

export function getCurrentLang() {
  return localStorage.getItem(LANG_STORAGE_KEY) === 'ru' ? 'ru' : 'en';
}

export function t(key) {
  const lang = getCurrentLang();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

window.__gtf_t = t;
window.__gtf_lang = getCurrentLang;

let currentUser = null;
let loadedUserId = null;
let newAvatarBase64 = null;
let viewingOtherUser = false;
let activeSteamIdForWishlist = null;

function closeGameDetailsModal() {
  document.getElementById('game-details-modal')?.classList.add('hidden');
  document.getElementById('game-details-modal-backdrop')?.classList.add('hidden');
}

function updateLanguageButtonsUI() {
  const lang = getCurrentLang();
  const btnEn = document.getElementById('lang-en');
  const btnRu = document.getElementById('lang-ru');
  const active = ['bg-transparent', 'border-purple-500', 'text-white'];
  const inactive = ['bg-transparent', 'border-white/20', 'text-gray-400'];

  if (lang === 'ru') {
    if (btnRu) btnRu.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnEn) btnEn.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  } else {
    if (btnEn) btnEn.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnRu) btnRu.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  }
}

export function applyLanguage(lang) {
  const normalized = lang === 'ru' ? 'ru' : 'en';
  localStorage.setItem(LANG_STORAGE_KEY, normalized);
  document.documentElement.lang = normalized;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key === 'sign_in_steam' && el.id === 'auth-btn-text' && currentUser) return;
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
    const steamBtnText = document.getElementById('steam-btn-text');
    const instructionText = document.getElementById('steam-instruction-text');
    if (steamBtnText) {
      steamBtnText.textContent = normalized === 'ru' ? 'Демо-режим активен' : 'Demo Mode Active';
    }
    if (instructionText) {
      instructionText.textContent =
        normalized === 'ru'
          ? 'Это демо-профиль с тестовыми данными. Войди через Steam, чтобы увидеть реальную статистику.'
          : 'This is a demo profile with fake data. Sign in with Steam to see your real stats.';
    }
  } else if (activeSteamIdForWishlist) {
    const steamBtnText = document.getElementById('steam-btn-text');
    const instructionText = document.getElementById('steam-instruction-text');
    if (steamBtnText) {
      steamBtnText.textContent =
        normalized === 'ru'
          ? `Steam привязан (${activeSteamIdForWishlist})`
          : `Steam Linked (${activeSteamIdForWishlist})`;
    }
    if (instructionText) {
      instructionText.textContent =
        normalized === 'ru'
          ? 'Аккаунт Steam подключён. Статистика и игры синхронизируются автоматически.'
          : 'Your Steam account is linked. Games and playtime sync automatically.';
    }
  }

  updateLanguageButtonsUI();

  if (getLastSteamData()) {
    renderSteamGames(getLastSteamData());
  }
  refreshDynamicTranslations();
}

document.getElementById('lang-en')?.addEventListener('click', () => applyLanguage('en'));
document.getElementById('lang-ru')?.addEventListener('click', () => applyLanguage('ru'));

// --- 1. КУРСОР И КНОПКИ ---
const cursor = document.getElementById('custom-cursor');
document.addEventListener('mousemove', (e) => {
  if (!cursor) return;
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
  const interactive = e.target.closest('a, button, input, select, .glass-card, .podium-slot, tr.cursor-pointer');
  cursor.classList.toggle('hover', Boolean(interactive));
});

document.querySelectorAll('.magnetic-btn').forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translate(0px, 0px)';
  });
});

// --- 2. ВХОД В ОДИН КЛИК ЧЕРЕЗ STEAM ---
const authBtn = document.getElementById('auth-btn');
const authBtnText = document.getElementById('auth-btn-text');
const authBtnChevron = document.getElementById('auth-btn-chevron');
const authDropdown = document.getElementById('auth-dropdown');
const authLogoutBtn = document.getElementById('auth-logout');
const authChangeAccountBtn = document.getElementById('auth-change-account');
const demoBtn = document.getElementById('demo-btn');

authBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!currentUser) {
    window.location.href = STEAM_AUTH_URL;
  } else {
    authDropdown?.classList.toggle('hidden');
  }
});

document.addEventListener('click', (e) => {
  const container = document.getElementById('auth-btn-container');
  if (container && !container.contains(e.target)) {
    authDropdown?.classList.add('hidden');
  }
});

async function handleSignOut() {
  authDropdown?.classList.add('hidden');
  await supabaseClient.auth.signOut();
  window.location.reload();
}

authLogoutBtn?.addEventListener('click', handleSignOut);
authChangeAccountBtn?.addEventListener('click', async () => {
  authDropdown?.classList.add('hidden');
  await supabaseClient.auth.signOut();
  window.location.href = STEAM_AUTH_URL;
});

// --- 3. ТЕМА, ВРЕМЯ, ПРИВАТНОСТЬ ---
function applyTheme() {
  const btnDark = document.getElementById('theme-dark');
  const btnLight = document.getElementById('theme-light');
  const active = ['bg-transparent', 'border-purple-500', 'text-white'];
  const inactive = ['bg-transparent', 'border-white/20', 'text-gray-400'];

  if (prefs.theme === 'light') {
    document.body.classList.add('light-theme');
    if (btnLight) btnLight.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnDark) btnDark.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  } else {
    document.body.classList.remove('light-theme');
    if (btnDark) btnDark.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnLight) btnLight.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  }
}

function updateTimeFormatUI() {
  const btnHours = document.getElementById('format-hours');
  const btnDays = document.getElementById('format-days');
  const active = ['bg-transparent', 'border-purple-500', 'text-white'];
  const inactive = ['bg-transparent', 'border-white/20', 'text-gray-400'];

  if (prefs.timeFormat === 'hours') {
    if (btnHours) btnHours.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnDays) btnDays.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  } else {
    if (btnDays) btnDays.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${active.join(' ')}`;
    if (btnHours) btnHours.className = `flex-1 py-3 text-sm font-bold rounded-lg border transition ${inactive.join(' ')}`;
  }
}

function updateLibraryVisibility() {
  const tableContainer = document.getElementById('table-container');
  const hiddenPlaceholder = document.getElementById('library-hidden-placeholder');
  const iconOpen = document.getElementById('icon-eye-open');
  const iconClosed = document.getElementById('icon-eye-closed');
  if (!tableContainer || !hiddenPlaceholder) return;

  tableContainer.classList.toggle('hidden', prefs.libraryHidden);
  hiddenPlaceholder.classList.toggle('hidden', !prefs.libraryHidden);
  iconOpen?.classList.toggle('hidden', prefs.libraryHidden);
  iconClosed?.classList.toggle('hidden', !prefs.libraryHidden);
}

document.getElementById('theme-dark')?.addEventListener('click', () => {
  setPref('theme', STORAGE_KEYS.theme, 'dark');
  applyTheme();
  if (getLastSteamData()) renderSteamGames(getLastSteamData());
});

document.getElementById('theme-light')?.addEventListener('click', () => {
  setPref('theme', STORAGE_KEYS.theme, 'light');
  applyTheme();
  if (getLastSteamData()) renderSteamGames(getLastSteamData());
});

document.getElementById('format-hours')?.addEventListener('click', () => {
  setPref('timeFormat', STORAGE_KEYS.timeFormat, 'hours');
  updateTimeFormatUI();
  if (getLastSteamData()) renderSteamGames(getLastSteamData());
});

document.getElementById('format-days')?.addEventListener('click', () => {
  setPref('timeFormat', STORAGE_KEYS.timeFormat, 'days');
  updateTimeFormatUI();
  if (getLastSteamData()) renderSteamGames(getLastSteamData());
});

document.getElementById('toggle-library')?.addEventListener('click', () => {
  setPref('libraryHidden', STORAGE_KEYS.libraryHidden, !prefs.libraryHidden);
  updateLibraryVisibility();
});

document.getElementById('game-search-input')?.addEventListener('input', renderFilteredGamesTable);
document.getElementById('game-sort-select')?.addEventListener('change', renderFilteredGamesTable);

// --- 4. ПРОФИЛЬ И СОСТОЯНИЕ АВТОРИЗАЦИИ ---
function setMemberSince(dateStr) {
  const el = document.getElementById('stat-member-since');
  if (!el) return;
  if (!dateStr) {
    el.textContent = '—';
    return;
  }
  const d = new Date(dateStr);
  const locale = getCurrentLang() === 'ru' ? 'ru-RU' : 'en-GB';
  el.textContent = Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function applyUsername(name) {
  const welcomeEl = document.getElementById('welcome-username');
  const profileNameEl = document.getElementById('profile-username');
  const avatarEl = document.getElementById('profile-avatar');
  if (welcomeEl) welcomeEl.textContent = name;
  if (profileNameEl) profileNameEl.textContent = name;
  if (avatarEl && !avatarEl.dataset.custom && !avatarEl.dataset.steamAvatar) {
    avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=512`;
  }
}

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    if (loadedUserId === currentUser.id) return;
    loadedUserId = currentUser.id;

    authBtnChevron?.classList.remove('hidden');
    authBtn?.classList.remove('btn-gradient');
    authBtn?.classList.add('border', 'border-white/10', 'hover:bg-white/5');
    setMemberSince(currentUser.created_at);
    demoBtn?.classList.add('hidden');

    let displayName = currentUser.user_metadata?.username || 'Player';

    try {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('id, username, avatar_url, steam_id')
        .eq('id', currentUser.id)
        .single();

      if (profile && !error) {
        if (profile.steam_id) {
          activeSteamIdForWishlist = String(profile.steam_id);
          setActiveWishlistSteamId(activeSteamIdForWishlist);
        }
        if (profile.username) {
          displayName = profile.username;
          applyUsername(profile.username);
          localStorage.setItem('greedtofame_custom_name', profile.username);
        }
        if (profile.avatar_url) {
          const avatarImg = document.getElementById('profile-avatar');
          if (avatarImg) {
            avatarImg.src = profile.avatar_url;
            avatarImg.dataset.custom = 'true';
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }

    if (authBtnText) authBtnText.textContent = displayName;
    await autoLoadSteamGames();
  } else {
    loadedUserId = null;
    activeSteamIdForWishlist = null;
    setActiveWishlistSteamId(null);
    if (authBtnText) authBtnText.textContent = t('sign_in_steam');
    authBtnChevron?.classList.add('hidden');
    authBtn?.classList.add('btn-gradient');
    authDropdown?.classList.add('hidden');
    applyUsername('Guest');
    setMemberSince(null);
    demoBtn?.classList.remove('hidden');

    if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
      enterDemoMode();
    }
  }
});

// --- 5. НАСТРОЙКИ И РЕДАКТИРОВАНИЕ ПРОФИЛЯ ---
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-modal-backdrop');
const usernameModal = document.getElementById('username-modal');
const usernameBackdrop = document.getElementById('username-modal-backdrop');
const usernameInput = document.getElementById('username-input');
const modalAvatarPreview = document.getElementById('modal-avatar-preview');
const avatarUploadInput = document.getElementById('avatar-upload');

function openSettingsModal() {
  updateTimeFormatUI();
  applyTheme();
  updateLanguageButtonsUI();
  settingsModal?.classList.remove('hidden');
  settingsBackdrop?.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal?.classList.add('hidden');
  settingsBackdrop?.classList.add('hidden');
}

function openUsernameModal() {
  if (usernameInput) {
    usernameInput.value = document.getElementById('profile-username')?.textContent || '';
  }
  const currentAvatar = document.getElementById('profile-avatar')?.src;
  if (modalAvatarPreview && currentAvatar) modalAvatarPreview.src = currentAvatar;
  newAvatarBase64 = null;
  usernameModal?.classList.remove('hidden');
  usernameBackdrop?.classList.remove('hidden');
  usernameInput?.focus();
}

function closeUsernameModal() {
  usernameModal?.classList.add('hidden');
  usernameBackdrop?.classList.add('hidden');
}

document.getElementById('settings-btn')?.addEventListener('click', openSettingsModal);
settingsBackdrop?.addEventListener('click', closeSettingsModal);
document.querySelectorAll('.settings-close').forEach((btn) => btn.addEventListener('click', closeSettingsModal));

document.getElementById('edit-profile')?.addEventListener('click', openUsernameModal);
usernameBackdrop?.addEventListener('click', closeUsernameModal);
document.querySelectorAll('.username-close').forEach((btn) => btn.addEventListener('click', closeUsernameModal));

document.getElementById('upload-avatar-btn')?.addEventListener('click', () => avatarUploadInput?.click());

avatarUploadInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert(getCurrentLang() === 'ru' ? 'Файл слишком большой (макс. 2 МБ).' : 'File too large (max 2MB).');
    avatarUploadInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    newAvatarBase64 = evt.target?.result || null;
    if (modalAvatarPreview && newAvatarBase64) modalAvatarPreview.src = newAvatarBase64;
  };
  reader.readAsDataURL(file);
});

document.getElementById('username-save')?.addEventListener('click', async () => {
  const newName = usernameInput?.value.trim();
  if (!newName) return;

  localStorage.setItem(STORAGE_KEYS.username, newName);
  localStorage.setItem('greedtofame_custom_name', newName);
  applyUsername(newName);
  if (currentUser && authBtnText) authBtnText.textContent = newName;

  if (newAvatarBase64) {
    const avatarImg = document.getElementById('profile-avatar');
    if (avatarImg) {
      avatarImg.src = newAvatarBase64;
      avatarImg.dataset.custom = 'true';
    }
  }

  closeUsernameModal();

  if (currentUser) {
    const updates = { id: currentUser.id, username: newName };
    if (newAvatarBase64) updates.avatar_url = newAvatarBase64;
    await supabaseClient.from('profiles').upsert(updates);
  }
});

const syncSteamBtn = document.getElementById('sync-steam-btn');
const syncSteamText = document.getElementById('sync-steam-text');
const syncSteamIcon = document.getElementById('sync-steam-icon');

syncSteamBtn?.addEventListener('click', async () => {
  if (syncSteamBtn.disabled) return;
  syncSteamBtn.disabled = true;
  if (syncSteamText) syncSteamText.textContent = t('syncing');
  syncSteamIcon?.classList.add('animate-spin');

  try {
    await syncFromSteamProfile();
    if (syncSteamText) syncSteamText.textContent = t('synced');
  } catch (err) {
    console.error('Steam sync error:', err);
    if (syncSteamText) syncSteamText.textContent = t('sync_failed');
  } finally {
    syncSteamIcon?.classList.remove('animate-spin');
    setTimeout(() => {
      syncSteamBtn.disabled = false;
      if (syncSteamText) syncSteamText.textContent = t('sync_steam');
    }, 1800);
  }
});

// --- 6. COMMUNITY ---
const communityResultsEl = document.getElementById('community-results');
const communitySearchEl = document.getElementById('community-search');
const backToMyProfileBtn = document.getElementById('back-to-my-profile-btn');

async function fetchProfiles(searchTerm = '', limit = 10) {
  if (!communityResultsEl) return;
  const isRu = getCurrentLang() === 'ru';
  communityResultsEl.classList.remove('hidden');
  communityResultsEl.innerHTML = `<p class="text-xs text-gray-400 py-2">${isRu ? 'Поиск игроков...' : 'Searching players...'}</p>`;

  let query = supabaseClient
    .from('profiles')
    .select('id, username, avatar_url, steam_id')
    .limit(limit);

  if (searchTerm.trim()) {
    query = query.ilike('username', `%${searchTerm.trim()}%`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    communityResultsEl.innerHTML = `<p class="text-xs text-red-400 py-2">${isRu ? 'Не удалось загрузить профили.' : 'Failed to load profiles.'}</p>`;
    return;
  }

  if (!profiles || profiles.length === 0) {
    communityResultsEl.innerHTML = `<p class="text-xs text-gray-500 py-2">${isRu ? 'Игроки не найдены.' : 'No players found.'}</p>`;
    return;
  }

  communityResultsEl.innerHTML = '';
  profiles.forEach((p) => {
    const name = p.username || 'Player';
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    const avatarSrc = p.avatar_url || fallbackAvatar;
    const statusLabel = p.steam_id
      ? isRu
        ? 'Steam привязан'
        : 'Steam linked'
      : isRu
      ? 'Нет Steam ID'
      : 'No Steam ID';

    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition text-left';
    item.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white truncate">${escapeHtml(name)}</p>
          <p class="text-[11px] text-gray-500">${statusLabel}</p>
        </div>
      </div>
      <span class="text-xs text-purple-400 font-semibold shrink-0">${isRu ? 'Открыть →' : 'View →'}</span>
    `;
    item.addEventListener('click', () => openCommunityProfile(p));
    communityResultsEl.appendChild(item);
  });
}

async function openCommunityProfile(profile) {
  viewingOtherUser = true;
  const name = profile.username || 'Player';
  const welcomeEl = document.getElementById('welcome-username');
  const profileNameEl = document.getElementById('profile-username');
  const avatarEl = document.getElementById('profile-avatar');

  if (welcomeEl) welcomeEl.textContent = name;
  if (profileNameEl) profileNameEl.textContent = name;
  if (avatarEl) {
    delete avatarEl.dataset.custom;
    delete avatarEl.dataset.steamAvatar;
    avatarEl.src =
      profile.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=512`;
  }
  setMemberSince(profile.created_at || null);
  syncSteamBtn?.classList.add('hidden');
  backToMyProfileBtn?.classList.remove('hidden');

  if (profile.steam_id) {
    setActiveWishlistSteamId(String(profile.steam_id));
    await loadSteamStatsForId(profile.steam_id, {
      applyPlayer: !profile.avatar_url,
      updateOwnAnalytics: false,
    });
  } else {
    setActiveWishlistSteamId(null);
    renderSteamGames({ response: { games: [] } });
  }

  document.getElementById('main-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

backToMyProfileBtn?.addEventListener('click', () => {
  viewingOtherUser = false;
  backToMyProfileBtn.classList.add('hidden');
  loadedUserId = null;
  window.location.reload();
});

let searchDebounce = null;
communitySearchEl?.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const val = e.target.value;
  searchDebounce = setTimeout(() => {
    if (!val.trim()) {
      communityResultsEl?.classList.add('hidden');
      return;
    }
    fetchProfiles(val, 8);
  }, 250);
});

document.getElementById('view-all-profiles')?.addEventListener('click', () => {
  fetchProfiles(communitySearchEl?.value || '', 20);
});

// --- 7. ДЕМО-РЕЖИМ ---
function enterDemoMode() {
  localStorage.setItem(STORAGE_KEYS.demoMode, 'true');
  setActiveWishlistSteamId(null);
  const demoData = buildDemoData();
  applyUsername('DemoPlayer');

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.src = 'https://ui-avatars.com/api/?name=Demo+Player&background=a855f7&color=fff&size=512';
    avatarEl.dataset.custom = 'true';
  }
  setMemberSince(new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString());

  const steamBtn = document.getElementById('connect-steam-btn');
  const steamBtnText = document.getElementById('steam-btn-text');
  const instructionText = document.getElementById('steam-instruction-text');
  const connectTitle = document.getElementById('connect-platform-title');
  const isRu = getCurrentLang() === 'ru';

  if (steamBtn && steamBtnText) {
    steamBtnText.textContent = isRu ? 'Демо-режим активен' : 'Demo Mode Active';
    steamBtn.removeAttribute('href');
    steamBtn.classList.remove('btn-gradient');
    steamBtn.classList.add('bg-cyan-600/20', 'border', 'border-cyan-500/50', 'cursor-default');
    const svgIcon = steamBtn.querySelector('svg');
    if (svgIcon) svgIcon.style.display = 'none';
  }
  if (instructionText) {
    instructionText.textContent = isRu
      ? 'Это демо-профиль с тестовыми данными. Войди через Steam, чтобы увидеть реальную статистику.'
      : 'This is a demo profile with fake data. Sign in with Steam to see your real stats.';
  }
  connectTitle?.classList.add('hidden');

  renderSteamGames(demoData);
  updateAnalytics(demoData.response.games);
  document.getElementById('demo-badge')?.classList.remove('hidden');
}

function exitDemoMode() {
  localStorage.removeItem(STORAGE_KEYS.demoMode);
  document.getElementById('demo-badge')?.classList.add('hidden');
}

demoBtn?.addEventListener('click', () => {
  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
    exitDemoMode();
    window.location.reload();
  } else {
    enterDemoMode();
    document.getElementById('main-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-connect-steam]')) {
    window.location.href = STEAM_AUTH_URL;
    return;
  }
  if (e.target.closest('[data-demo]')) {
    enterDemoMode();
    document.getElementById('main-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// --- 8. ЭКРАНЫ ---
document.getElementById('show-analytics-btn')?.addEventListener('click', () => {
  document.getElementById('dashboard-page')?.classList.add('hidden');
  document.getElementById('analytics-page')?.classList.remove('hidden');
});

document.getElementById('back-to-dashboard-btn')?.addEventListener('click', () => {
  document.getElementById('analytics-page')?.classList.add('hidden');
  document.getElementById('dashboard-page')?.classList.remove('hidden');
});

// --- 9. ЗАВЕРШЕНИЕ ВХОДА ПО ТОКЕНУ ОТ STEAM ---
async function handleSteamCallbackToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenHash = urlParams.get('steam_token');
  const steamError = urlParams.get('steam_error');

  if (steamError) {
    window.history.replaceState({}, document.title, window.location.pathname);
    alert(`Steam sign-in error: ${steamError}`);
    return;
  }

  if (!tokenHash) return;

  window.history.replaceState({}, document.title, window.location.pathname);
  localStorage.removeItem(STORAGE_KEYS.demoMode);

  const { error } = await supabaseClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (error) {
    console.error('Steam OTP verify failed:', error);
    alert(
      getCurrentLang() === 'ru'
        ? 'Не удалось завершить вход через Steam. Попробуй ещё раз.'
        : 'Failed to complete Steam login. Please try again.'
    );
  }
}

// --- 10. СТАРТ ---
(async function init() {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.username);
  if (savedUsername && !viewingOtherUser) applyUsername(savedUsername);

  updateTimeFormatUI();
  applyTheme();
  applyLanguage(getCurrentLang());
  updateLibraryVisibility();
  toggleEmptyStates(false);
  initFeatures();

  // Надёжное закрытие окна детальной статистики игры
  document.getElementById('close-game-details-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeGameDetailsModal();
  });

  document.getElementById('game-details-modal-backdrop')?.addEventListener('click', () => {
    closeGameDetailsModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeGameDetailsModal();
    }
  });

  await handleSteamCallbackToken();

  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true' && !currentUser) {
    enterDemoMode();
  }
})();
