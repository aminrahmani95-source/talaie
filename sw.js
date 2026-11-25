/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-43eeb466a0e5';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-CU_1hZHh.js","./assets/CeoMasterRegistry-CXKJmG8P.js","./assets/DailyLogModal-B483gOuw.js","./assets/FailedOperationsModal-Qq6bYW3c.js","./assets/HandoverCertificateModal-r818-7i_.js","./assets/MaterialCenter-BDpdNxOq.js","./assets/MaterialRequestModal-F3coOv3g.js","./assets/MeasurementDashboard-D9R4QVO-.js","./assets/MonthPlanner-ZgOFocMb.js","./assets/OperationsControlCenter-BLJ4-csz.js","./assets/PageHeader-Dxcm1MUZ.js","./assets/PendingOperationsModal-DMxTnmgg.js","./assets/PersonnelEvaluationModal-DMBlX3bs.js","./assets/PreInstallationModal-Wf6Tss8J.js","./assets/ProductCountsInput-DDAsiOld.js","./assets/ProjectDossierModal-CDeQCHUD.js","./assets/ProjectFormModal-B4R8ioTv.js","./assets/ProjectManagerSheet-uyhHKxSS.js","./assets/ProjectPassportPrint-Bt4rNJFb.js","./assets/ProposalViewerModal-DFMHaJZS.js","./assets/QcDesk-BkCiA6OW.js","./assets/ReportCompletionModal-B-jihPwz.js","./assets/ReportStuckModal-C_pK3Kvr.js","./assets/SalesPortal-Bqn5LZ_v.js","./assets/SegmentedControl-Cuf1q5HW.js","./assets/SettingsView-CWpuEJS3.js","./assets/StuckProjectsDesk-D0402LKu.js","./assets/TechniciansManager-0__NOf6d.js","./assets/TicketCenter-BKyDUpcM.js","./assets/TicketModal-cnml7_7u.js","./assets/ToolChecklistDrawer-DRyAYYMf.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-ByO5wqR0.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-CC8xmOp3.js","./assets/index-DL_UWDNT.css","./assets/jalali-B7fyrsId.js","./assets/offlineQueue-D2EleRKP.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/vendor-icons-DdhJ1CLe.js","./assets/vendor-react-lPhd8y74.js","./assets/vendor-supabase-DtuMx0jC.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
