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