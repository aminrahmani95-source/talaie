/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-f07a22d7a3e6';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-CIjSAtcZ.js","./assets/CeoMasterRegistry-BfpqJO-X.js","./assets/DailyLogModal-rv5LVPNY.js","./assets/FailedOperationsModal-BfDkJffH.js","./assets/HandoverCertificateModal-DLPzdmmV.js","./assets/MaterialCenter-DDXxaTI9.js","./assets/MaterialRequestModal-CK5N8jgU.js","./assets/MeasurementDashboard-B5VPhw5U.js","./assets/MonthPlanner-GyRHCYrp.js","./assets/OperationsControlCenter-BNcSjlPo.js","./assets/PageHeader-BagnmJzy.js","./assets/PendingOperationsModal-DEk2ahCH.js","./assets/PersonnelEvaluationModal-BJlDgOMJ.js","./assets/PreInstallationModal-Bek3AZ0P.js","./assets/ProjectDossierModal-53yK8X6F.js","./assets/ProjectFormModal-BF-OIZ5c.js","./assets/ProjectManagerSheet-CeuQHTI2.js","./assets/ProjectPassportPrint-DqkEV6Kl.js","./assets/ProposalViewerModal-anE3FUWb.js","./assets/QcDesk-CHKcWfkZ.js","./assets/ReportCompletionModal-BQJyHBu6.js","./assets/ReportStuckModal-DOR2eQ-3.js","./assets/SalesPortal-DyCLHQc_.js","./assets/SegmentedControl-CY4UbeGT.js","./assets/SettingsView-Bq-zPINS.js","./assets/StuckProjectsDesk-OfwcCZyt.js","./assets/TechniciansManager-DlM0TYBf.js","./assets/TicketCenter-BNZp7zud.js","./assets/TicketModal-CZ3fbJaZ.js","./assets/ToolChecklistDrawer-DeZLoJtK.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-BgzlWXFV.js","./assets/confetti.module-CAXNRs-2.js","./assets/index-Bznf4Rpb.css","./assets/index-TMA1mzT3.js","./assets/offlineQueue-W577M2FM.js","./assets/rolldown-runtime-WkwZ5CU-.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/vendor-icons-C1Su5MZ3.js","./assets/vendor-react-Dph6fTCk.js","./assets/vendor-supabase-DtuMx0jC.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Add files one by one so a single missing optional file never breaks installation
      Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('talaie-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Tapping a phone notification: bring the open app to the front (or open it) and go to the related section
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tab = event.notification.data && event.notification.data.tab;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.registration.scope));
      if (win) {
        if (tab) win.postMessage({ type: 'OPEN_TAB', tab });
        return win.focus();
      }
      return self.clients.openWindow('./' + (tab ? '#tab=' + tab : ''));
    })
  );
});

// Server-sent push (works when the app is closed, once a push server is set up)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'گالری طلایی', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'گالری طلایی', {
      body: data.body || '',
      tag: data.tag,
      icon: './icon-192.png',
      badge: './badge-96.png',
      dir: 'rtl',
      lang: 'fa',
      data: { tab: data.tab },
    })
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch API / auth / storage traffic (Supabase etc.): it must always hit the network.
  if (url.origin !== self.location.origin) return;

  // Pages: network first (always fresh after a deploy), cached shell when offline or very slow.
  if (req.mode === 'navigate') {
    event.respondWith(
      Promise.race([fetch(req), timeout(5000)])
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Hashed build files never change: cache first.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Icons, fonts, manifest: serve cached copy immediately, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
