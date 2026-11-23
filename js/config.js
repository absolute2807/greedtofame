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

export function applyPlaytimeTier(totalHours, isRu = false) {
  const hrs = Number(totalHours) || 0;
  const root = document.documentElement;
  const badge = document.getElementById('playtime-tier-badge');

  let tier;
  if (hrs >= 3000) {
    tier = {
      label: isRu ? 'Легенда' : 'Legend',
      color: '#facc15',
      gradient: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)',
      btnText: '#0f172a',
    };
  } else if (hrs >= 1000) {
    tier = {
      label: isRu ? 'Хардкор' : 'Hardcore',
      color: '#a855f7',
      gradient: 'linear-gradient(135deg, #a855f7 0%, #2563eb 100%)',
      btnText: '#ffffff',
    };
  } else if (hrs >= 500) {
    tier = {
      label: isRu ? 'Ветеран' : 'Veteran',
      color: '#cbd5e1',
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
      btnText: '#0f172a',
    };
  } else if (hrs >= 100) {
    tier = {
      label: isRu ? 'Активный' : 'Active',
      color: '#4ade80',
      gradient: 'linear-gradient(135deg, #4ade80 0%, #059669 100%)',
      btnText: '#062815',
    };
  } else {
    tier = {
      label: isRu ? 'Новичок' : 'Standard',
      color: '#9ca3af',
      gradient: 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)',
      btnText: '#ffffff',
    };
  }

  root.style.setProperty('--tier-color', tier.color);
  root.style.setProperty('--tier-gradient', tier.gradient);
  root.style.setProperty('--tier-btn-text', tier.btnText);

  if (badge) {
    badge.textContent = tier.label;
    badge.style.color = tier.color;
    badge.style.borderColor = `${tier.color}88`;
  }

  return tier;
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
