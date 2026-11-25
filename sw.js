/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-6e123ad7444a';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-DXZy9nZD.js","./assets/CeoMasterRegistry-CkqVwVVP.js","./assets/DailyLogModal-C2hxhJfC.js","./assets/FailedOperationsModal-cQNkU9ZQ.js","./assets/HandoverCertificateModal-CZ9oOZCH.js","./assets/MaterialCenter-BOWRqjXN.js","./assets/MaterialRequestModal-CJbqlr22.js","./assets/MeasurementDashboard-CBZaArM1.js","./assets/MonthPlanner-C3DDCIJr.js","./assets/OperationsControlCenter-BD6_YIkM.js","./assets/PageHeader-Dxcm1MUZ.js","./assets/PendingOperationsModal-C3rInRes.js","./assets/PersonnelEvaluationModal-CoTPFEGx.js","./assets/PreInstallationModal-I_e59E4m.js","./assets/ProductCountsInput-DAmEiscI.js","./assets/ProjectDossierModal-DsWHB6X2.js","./assets/ProjectFormModal-2i8t2gzb.js","./assets/ProjectManagerSheet-_PvJ0QQX.js","./assets/ProjectPassportPrint-CP-EUShw.js","./assets/ProposalViewerModal-Colqa2Y1.js","./assets/QcDesk-hNyJfLZe.js","./assets/ReportCompletionModal-DF5ZQDiw.js","./assets/ReportStuckModal-ifHe_Qvh.js","./assets/SalesPortal-D78vNhuE.js","./assets/SegmentedControl-Cuf1q5HW.js","./assets/SettingsView-BnDOknll.js","./assets/StuckProjectsDesk-j6vDu6_D.js","./assets/TechniciansManager-Bv4Lnwad.js","./assets/TicketCenter-By9x_kJ6.js","./assets/TicketModal-BTvhMgVc.js","./assets/ToolChecklistDrawer-DetT7Rrg.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-CeIhn-UO.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-BmoizklL.js","./assets/index-DQEmcEW0.css","./assets/jalali-B7fyrsId.js","./assets/offlineQueue-D2EleRKP.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/vendor-icons-DT3109t4.js","./assets/vendor-react-lPhd8y74.js","./assets/vendor-supabase-DtuMx0jC.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
