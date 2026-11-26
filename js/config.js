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
    nameEn: 'Standard',
    nameRu: 'Новичок',
    color: '#cbd5e1',
    softBg: 'rgba(203, 213, 225, 0.12)',
    grad: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
  };

  if (hours >= 5000) {
    tier = {
      nameEn: 'Mythic',
      nameRu: 'Мифический',
      color: '#f43f5e',
      softBg: 'rgba(244, 63, 94, 0.14)',
      grad: 'linear-gradient(135deg, #e11d48 0%, #f59e0b 100%)',
    };
  } else if (hours >= 2000) {
    tier = {
      nameEn: 'Legend',
      nameRu: 'Легенда',
      color: '#facc15',
      softBg: 'rgba(250, 204, 21, 0.14)',
      grad: 'linear-gradient(135deg, #eab308 0%, #f97316 100%)',
    };
  } else if (hours >= 1000) {
    tier = {
      nameEn: 'Veteran',
      nameRu: 'Ветеран',
      color: '#a855f7',
      softBg: 'rgba(168, 85, 247, 0.15)',
      grad: 'linear-gradient(135deg, #9333ea 0%, #3b82f6 100%)',
    };
  } else if (hours >= 300) {
    tier = {
      nameEn: 'Pro',
      nameRu: 'Профи',
      color: '#22d3ee',
      softBg: 'rgba(34, 211, 238, 0.14)',
      grad: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
    };
  } else if (hours >= 50) {
    tier = {
      nameEn: 'Gamer',
      nameRu: 'Геймер',
      color: '#34d399',
      softBg: 'rgba(52, 211, 153, 0.14)',
      grad: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
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
