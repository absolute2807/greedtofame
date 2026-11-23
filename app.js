import { supabaseClient, STORAGE_KEYS, prefs, setPref } from './config.js';
import { renderSteamGames, autoLoadSteamGames, buildDemoData, getLastSteamData, toggleEmptyStates } from './steam.js';
import { updateAnalytics } from './analytics.js';

let currentUser = null;
let newAvatarBase64 = null;

// --- 1. БАЗОВЫЙ UI (КУРСОР И МОДАЛКИ) — РАБОТАЕТ ВСЕГДА ---
const cursor = document.getElementById('custom-cursor');
document.addEventListener('mousemove', (e) => {
  if (!cursor) return;
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
  const interactive = e.target.closest('a, button, input, .glass-card, .podium-frame');
  cursor.classList.toggle('hover', Boolean(interactive));
});

document.querySelectorAll('.magnetic-btn').forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translate(0px, 0px)';
  });
});

const authBtn = document.getElementById('auth-btn');
const authModal = document.getElementById('auth-modal');
const authBackdrop = document.getElementById('auth-modal-backdrop');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnSignin = document.getElementById('btn-signin');
const btnSignup = document.getElementById('btn-signup');
const btnCloseModal = document.getElementById('btn-close-modal');
const authMessage = document.getElementById('auth-message');
const authBtnText = document.getElementById('auth-btn-text');
const authDropdown = document.getElementById('auth-dropdown');
const authLogoutBtn = document.getElementById('auth-logout');
const authChangeAccountBtn = document.getElementById('auth-change-account');
const demoBtn = document.getElementById('demo-btn');

function openAuthModal() {
  authModal?.classList.remove('hidden');
  authBackdrop?.classList.remove('hidden');
  if (authMessage) authMessage.textContent = '';
  authEmail?.focus();
}

function closeAuthModal() {
  authModal?.classList.add('hidden');
  authBackdrop?.classList.add('hidden');
  if (authMessage) authMessage.textContent = '';
}

authBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if ((authBtnText?.textContent || '').trim() === 'Login') {
    openAuthModal();
  } else {
    authDropdown?.classList.toggle('hidden');
  }
});

btnCloseModal?.addEventListener('click', closeAuthModal);
authBackdrop?.addEventListener('click', closeAuthModal);

document.addEventListener('click', (e) => {
  const container = document.getElementById('auth-btn-container');
  if (container && !container.contains(e.target)) {
    authDropdown?.classList.add('hidden');
  }
});

// --- 2. ТЕМА, ВРЕМЯ, ПРИВАТНОСТЬ ---
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

// --- 3. ПРОФИЛЬ И АВТОРИЗАЦИЯ SUPABASE ---
btnSignin?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail?.value.trim() || '';
  const password = authPassword?.value.trim() || '';
  if (!email || !password) {
    if (authMessage) {
      authMessage.textContent = 'Please enter email and password.';
      authMessage.className = 'text-sm mt-4 text-center text-red-400';
    }
    return;
  }
  btnSignin.disabled = true;
  btnSignin.textContent = 'Signing in...';
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    if (authMessage) {
      authMessage.textContent = error.message;
      authMessage.className = 'text-sm mt-4 text-center text-red-400';
    }
    btnSignin.disabled = false;
    btnSignin.textContent = 'Sign In';
  } else {
    window.location.reload();
  }
});

btnSignup?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail?.value.trim() || '';
  const password = authPassword?.value.trim() || '';
  if (!email || !password) {
    if (authMessage) {
      authMessage.textContent = 'Please enter email and password.';
      authMessage.className = 'text-sm mt-4 text-center text-red-400';
    }
    return;
  }
  btnSignup.disabled = true;
  btnSignup.textContent = 'Creating...';
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    if (authMessage) {
      authMessage.textContent = error.message;
      authMessage.className = 'text-sm mt-4 text-center text-red-400';
    }
  } else if (authMessage) {
    authMessage.textContent = 'Account created! Check your email for confirmation.';
    authMessage.className = 'text-sm mt-4 text-center text-green-400';
  }
  btnSignup.disabled = false;
  btnSignup.textContent = 'Sign Up';
});

async function handleSignOut() {
  authDropdown?.classList.add('hidden');
  await supabaseClient.auth.signOut();
  window.location.reload();
}

authLogoutBtn?.addEventListener('click', handleSignOut);
authChangeAccountBtn?.addEventListener('click', handleSignOut);

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
  if (avatarEl && !avatarEl.dataset.custom) {
    avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=512`;
  }
}

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    if (authBtnText) authBtnText.textContent = currentUser.email || 'Account';
    closeAuthModal();
    setMemberSince(currentUser.created_at);
    demoBtn?.classList.add('hidden');

    try {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profile && !error) {
        if (profile.username) applyUsername(profile.username);
        if (profile.avatar_url) {
          const avatarImg = document.getElementById('profile-avatar');
          if (avatarImg) {
            avatarImg.src = profile.avatar_url;
            avatarImg.dataset.custom = 'true';
          }
        }
      } else if (error?.code === 'PGRST116') {
        await supabaseClient.from('profiles').insert({
          id: currentUser.id,
          username: currentUser.email?.split('@')[0] || 'User',
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }

    await autoLoadSteamGames();
  } else {
    if (authBtnText) authBtnText.textContent = 'Login';
    authDropdown?.classList.add('hidden');
    applyUsername('Guest');
    setMemberSince(null);
    demoBtn?.classList.remove('hidden');

    if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
      enterDemoMode();
    }
  }
});

// --- 4. МОДАЛКИ НАСТРОЕК И ПРОФИЛЯ ---
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
    usernameInput.value = document.getElementById('welcome-username')?.textContent || '';
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
  applyUsername(newName);

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

// --- 5. ДЕМО-РЕЖИМ ---
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
  if (instructionText) instructionText.textContent = 'This is a demo profile with fake data. Sign in and connect Steam to see your real stats.';
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
    const steamBtn = document.getElementById('connect-steam-btn');
    const href = steamBtn?.getAttribute('href');
    if (href) window.location.href = href;
    else steamBtn?.click();
    return;
  }
  if (e.target.closest('[data-demo]')) {
    enterDemoMode();
    document.getElementById('main-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// --- 6. ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ И SHARE ---
document.getElementById('show-analytics-btn')?.addEventListener('click', () => {
  document.getElementById('dashboard-page')?.classList.add('hidden');
  document.getElementById('analytics-page')?.classList.remove('hidden');
});

document.getElementById('back-to-dashboard-btn')?.addEventListener('click', () => {
  document.getElementById('analytics-page')?.classList.add('hidden');
  document.getElementById('dashboard-page')?.classList.remove('hidden');
});

const shareBtn = document.getElementById('share-profile-btn');
shareBtn?.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const originalText = shareBtn.textContent;
    shareBtn.textContent = 'Copied!';
    setTimeout(() => { shareBtn.textContent = originalText; }, 2000);
  });
});

// --- 7. ВОЗВРАТ ИЗ STEAM OPENID ---
async function handleSteamReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('openid.mode') !== 'id_res') return;

  const claimedId = urlParams.get('openid.claimed_id');
  if (!claimedId) return;

  const steamId = claimedId.split('/').pop();
  window.history.replaceState({}, document.title, window.location.pathname);

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert('Сначала войдите в аккаунт на сайте, чтобы привязать Steam.');
    return;
  }

  const { error } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, steam_id: steamId }, { onConflict: 'id' });

  if (!error) window.location.reload();
  else console.error('Ошибка сохранения в базу:', error);
}

// --- 8. СТАРТ ---
(async function init() {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.username);
  if (savedUsername) applyUsername(savedUsername);

  updateTimeFormatUI();
  applyTheme();
  updateLibraryVisibility();
  toggleEmptyStates(false);

  await handleSteamReturn();

  if (localStorage.getItem(STORAGE_KEYS.demoMode) === 'true') {
    enterDemoMode();
  }
})();
