/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-a3150cdd63ea';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-FvH3udn5.js","./assets/CeoMasterRegistry-CYna1hie.js","./assets/DailyLogModal--fEb2kZr.js","./assets/FailedOperationsModal-cgQRvB62.js","./assets/HandoverCertificateModal-Bylvd501.js","./assets/MaterialCenter-BxZVIu0v.js","./assets/MaterialRequestModal-COMtoEzW.js","./assets/MeasurementDashboard-MEpsKw2m.js","./assets/MonthPlanner-CXuAW564.js","./assets/OperationsControlCenter-mORAEIqZ.js","./assets/PageHeader-Dxcm1MUZ.js","./assets/PendingOperationsModal-DJOU1q-F.js","./assets/PersonnelEvaluationModal-Cxw0pnNc.js","./assets/PreInstallationModal-BB6wsZnF.js","./assets/ProductCountsInput-Bgd_TcNy.js","./assets/ProjectDossierModal-BfdsDr1Z.js","./assets/ProjectFormModal-IV-Fwo47.js","./assets/ProjectManagerSheet-D02wyuwk.js","./assets/ProjectPassportPrint-DzgtyDds.js","./assets/ProposalViewerModal-DmrL3J96.js","./assets/QcDesk-oUckTl-8.js","./assets/ReportCompletionModal-BHEojjMB.js","./assets/ReportStuckModal-D4zrhvUe.js","./assets/SalesPortal-Cxf6I7jW.js","./assets/SegmentedControl-Cuf1q5HW.js","./assets/SettingsView-Cu0UwQof.js","./assets/StuckProjectsDesk-asTibGKO.js","./assets/TechniciansManager-73eaUBkf.js","./assets/TicketCenter-B7WPDL-X.js","./assets/TicketModal-okBQ1iMe.js","./assets/ToolChecklistDrawer-BT7_x2js.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-DRPaNo3-.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-DQEmcEW0.css","./assets/index-DmSe_l3S.js","./assets/jalali-B7fyrsId.js","./assets/offlineQueue-agkgnaZs.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/vendor-icons-DT3109t4.js","./assets/vendor-react-lPhd8y74.js","./assets/vendor-supabase-DtuMx0jC.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

self.addEventListener('install', (event) => {
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
