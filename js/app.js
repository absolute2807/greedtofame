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
import { initFeatures } from './features.js';

const STEAM_AUTH_URL = 'https://tcdtdftgpdjmrpqoltlg.supabase.co/functions/v1/steam-auth-callback';

let currentUser = null;
let loadedUserId = null;
let newAvatarBase64 = null;
let viewingOtherUser = false;

// --- 1. КУРСОР И КНОПКИ ---
const cursor = document.getElementById('custom-cursor');
document.addEventListener('mousemove', (e) => {
  if (!cursor) return;
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
  const interactive = e.target.closest('a, button, input, select, .glass-card, .podium-slot');
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
  el.textContent = Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
    if (authBtnText) authBtnText.textContent = 'Sign in with Steam';
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
    alert('File too large (max 2MB).');
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
  if (syncSteamText) syncSteamText.textContent = 'Syncing...';
  syncSteamIcon?.classList.add('animate-spin');

  try {
    await syncFromSteamProfile();
    if (syncSteamText) syncSteamText.textContent = 'Synced!';
  } catch (err) {
    console.error('Steam sync error:', err);
    if (syncSteamText) syncSteamText.textContent = 'Sync failed';
  } finally {
    syncSteamIcon?.classList.remove('animate-spin');
    setTimeout(() => {
      syncSteamBtn.disabled = false;
      if (syncSteamText) syncSteamText.textContent = 'Sync from Steam';
    }, 1800);
  }
});

// --- 6. COMMUNITY ---
const communityResultsEl = document.getElementById('community-results');
const communitySearchEl = document.getElementById('community-search');
const backToMyProfileBtn = document.getElementById('back-to-my-profile-btn');

async function fetchProfiles(searchTerm = '', limit = 10) {
  if (!communityResultsEl) return;
  communityResultsEl.classList.remove('hidden');
  communityResultsEl.innerHTML = '<p class="text-xs text-gray-400 py-2">Searching players...</p>';

  let query = supabaseClient
    .from('profiles')
    .select('id, username, avatar_url, steam_id')
    .limit(limit);

  if (searchTerm.trim()) {
    query = query.ilike('username', `%${searchTerm.trim()}%`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    communityResultsEl.innerHTML = '<p class="text-xs text-red-400 py-2">Failed to load profiles.</p>';
    return;
  }

  if (!profiles || profiles.length === 0) {
    communityResultsEl.innerHTML = '<p class="text-xs text-gray-500 py-2">No players found.</p>';
    return;
  }

  communityResultsEl.innerHTML = '';
  profiles.forEach((p) => {
    const name = p.username || 'Player';
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;
    const avatarSrc = p.avatar_url || fallbackAvatar;

    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition text-left';
    item.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(name)}" class="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white truncate">${escapeHtml(name)}</p>
          <p class="text-[11px] text-gray-500">${p.steam_id ? 'Steam linked' : 'No Steam ID'}</p>
        </div>
      </div>
      <span class="text-xs text-purple-400 font-semibold shrink-0">View →</span>
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
    await loadSteamStatsForId(profile.steam_id, {
      applyPlayer: !profile.avatar_url,
      updateOwnAnalytics: false,
    });
  } else {
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

  if (steamBtn && steamBtnText) {
    steamBtnText.textContent = 'Demo Mode Active';
    steamBtn.removeAttribute('href');
    steamBtn.classList.remove('btn-gradient');
    steamBtn.classList.add('bg-cyan-600/20', 'border', 'border-cyan-500/50', 'cursor-default');
    const svgIcon = steamBtn.querySelector('svg');
    if (svgIcon) svgIcon.style.display = 'none';
  }
  if (instructionText) {
    instructionText.textContent = 'This is a demo profile with fake data. Sign in with Steam to see your real stats.';
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
    alert('Failed to complete Steam login. Please try again.');
  }
}

// --- 10. СТАРТ ---
(async function init() {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.username);
  if (savedUsername && !viewingOtherUser) applyUsername(savedUsername);

  updateTimeFormatUI();
  applyTheme();
  updateLibraryVisibility();
  toggleEmptyStates(false);
  initFeatures();

  await handleSteamCallbackToken();

  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true' && !currentUser) {
    enterDemoMode();
  }
})();
