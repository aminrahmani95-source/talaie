/**
 * ثبت Service Worker تا برنامه بدون اینترنت هم باز شود (مهم برای نصاب‌ها سر کارگاه).
 * نسخه جدید بی‌صدا دانلود می‌شود و با رویداد SW_UPDATE_EVENT به کاربر اطلاع داده می‌شود؛
 * تا کاربر «به‌روزرسانی» را نزند، نسخه فعلی (و فرم‌های نیمه‌کاره‌اش) دست نمی‌خورد.
 */
export const SW_UPDATE_EVENT = 'talaie-sw-update-available';

let waitingWorker: ServiceWorker | null = null;

export function applyServiceWorkerUpdate(): void {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const announce = (worker: ServiceWorker) => {
    waitingWorker = worker;
    window.dispatchEvent(new Event(SW_UPDATE_EVENT));
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // A new version may already be waiting (downloaded in an earlier visit)
        if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // Only prompt when replacing an existing version (not on the very first install)
            if (installing.state === 'installed' && navigator.serviceWorker.controller) announce(installing);
          });
        });

        // Look for new deployments periodically and whenever the app comes back to the foreground
        const check = () => reg.update().catch(() => undefined);
        check();
        setInterval(check, 10 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch(() => {
        // Registration failure only means no offline support; the app keeps working online.
      });

    // A tapped phone notification asks the open app to show the related section
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OPEN_TAB' && event.data.tab) {
        window.dispatchEvent(new CustomEvent('talaie:notification-open-tab', { detail: event.data.tab }));
      }
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
