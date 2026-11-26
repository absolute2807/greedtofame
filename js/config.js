export const SUPABASE_URL = 'https://tcdtdftgpdjmrpqoltlg.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_qzOnbq_MxgMQA0RfRGIwPQ_cNAMrR8p';

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const STORAGE_KEYS = {
  username: 'gt_username',
  timeFormat: 'gt_time_format',
  theme: 'gt_theme',
  libraryHidden: 'gt_library_hidden',
  demoMode: 'gt_demo_mode',
};

export const prefs = {
  theme: localStorage.getItem(STORAGE_KEYS.theme) || 'dark',
  timeFormat: localStorage.getItem(STORAGE_KEYS.timeFormat) || 'hours',
  libraryHidden: localStorage.getItem(STORAGE_KEYS.libraryHidden) === 'true',
};

export function setPref(key, storageKey, value) {
  prefs[key] = value;
  localStorage.setItem(storageKey, String(value));
}

export function formatPlaytime(hours, format = prefs.timeFormat) {
  return format === 'days' ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function animateValue(obj, start, end, duration, suffix = 'h') {
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const current = Math.floor(progress * (end - start) + start);
    obj.textContent = `${current}${suffix}`;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

export function applyPlaytimeTier(totalHours = 0, isRu = false) {
  const hours = Number(totalHours) || 0;

  let tier = {
    nameEn: 'Bronze',
    nameRu: 'Бронзовый',
    color: '#d97706',
    softBg: 'rgba(217, 119, 6, 0.14)',
    grad: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
  };

  if (hours >= 5000) {
    tier = {
      nameEn: 'Mythic',
      nameRu: 'Мифический',
      color: '#ef4444',
      softBg: 'rgba(239, 68, 68, 0.15)',
      grad: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    };
  } else if (hours >= 1000) {
    tier = {
      nameEn: 'Gold',
      nameRu: 'Золотой',
      color: '#facc15',
      softBg: 'rgba(250, 204, 21, 0.14)',
      grad: 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
    };
  } else if (hours >= 500) {
    tier = {
      nameEn: 'Silver',
      nameRu: 'Серебряный',
      color: '#e2e8f0',
      softBg: 'rgba(226, 232, 240, 0.14)',
      grad: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
    };
  }

  const root = document.documentElement;
  root.style.setProperty('--tier-color', tier.color);
  root.style.setProperty('--tier-soft-bg', tier.softBg);
  root.style.setProperty('--tier-gradient', tier.grad);

  const badge = document.getElementById('playtime-tier-badge');
  if (badge) {
    badge.textContent = isRu ? tier.nameRu : tier.nameEn;
  }
}
