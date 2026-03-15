import { API_BASE } from './api';

export function startVersionWatcher({ intervalMs = 5 * 60 * 1000 } = {}) {
  let stopped = false;

  const getStored = () => {
    try { return sessionStorage.getItem('app_version') || null; } catch { return null; }
  };
  const setStored = (v) => {
    try { sessionStorage.setItem('app_version', v); } catch {}
  };

  const fetchLatest = async () => {
    try {
      const res = await fetch(`${API_BASE}/version.json`, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return String(data?.version || data?.commit || data?.buildId || data?.build || '');
    } catch {
      return null;
    }
  };

  const check = async () => {
    if (stopped) return;
    const latest = await fetchLatest();
    if (!latest) return;
    const current = getStored();
    if (!current) {
      setStored(latest);
      return;
    }
    if (latest !== current) {
      setStored(latest);
      window.location.reload(true);
    }
  };

  // Initial check soon after load
  if (document.readyState === 'complete') {
    setTimeout(check, 500);
  } else {
    window.addEventListener('load', () => setTimeout(check, 500), { once: true });
  }

  // Poll periodically
  const id = setInterval(check, intervalMs);

  // Refresh when tab becomes active
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });

  return () => {
    stopped = true;
    clearInterval(id);
  };
}

