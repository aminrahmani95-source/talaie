/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-f64816dade2b';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-B8W2ZLKE.js","./assets/CeoMasterRegistry-PHRgEz8S.js","./assets/DailyLogModal-CUrsGpsV.js","./assets/FailedOperationsModal-BO6wCnPM.js","./assets/HandoverCertificateModal-D5LeEv5S.js","./assets/MaterialCenter-jGBr5NOq.js","./assets/MaterialRequestModal-BJB5_9MF.js","./assets/MeasurementDashboard-hMP3qGhD.js","./assets/MonthPlanner-ByUT1apy.js","./assets/OperationsControlCenter-AmokAPJb.js","./assets/PageHeader-Dxcm1MUZ.js","./assets/PendingOperationsModal-is5qMJhW.js","./assets/PersonnelEvaluationModal-DWiqe9j2.js","./assets/PreInstallationModal-ullDPo2O.js","./assets/ProjectDossierModal-BNvMhCp8.js","./assets/ProjectFormModal-Dk1gbXBl.js","./assets/ProjectManagerSheet-s_AxPC9C.js","./assets/ProjectPassportPrint-iZww16zK.js","./assets/ProposalViewerModal-Dc2kOQYo.js","./assets/QcDesk-Cxay-Fnu.js","./assets/ReportCompletionModal-15n5nq6a.js","./assets/ReportStuckModal-8uauhsFf.js","./assets/SalesPortal-BIv5xXJL.js","./assets/SegmentedControl-Cuf1q5HW.js","./assets/SettingsView-p_vwUt2Z.js","./assets/StuckProjectsDesk-DbkAp3XX.js","./assets/TechniciansManager-BH_IiK2R.js","./assets/TicketCenter-CMbqBlIF.js","./assets/TicketModal-B1Iu-pLi.js","./assets/ToolChecklistDrawer-M0uVfQO1.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-B9fm_Kmp.js","./assets/confetti.module-CAXNRs-2.js","./assets/index-DrbsGEJr.js","./assets/index-wNcqCjm7.css","./assets/jalali-B7fyrsId.js","./assets/offlineQueue-W577M2FM.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/vendor-icons-CGMb6xlX.js","./assets/vendor-react-lPhd8y74.js","./assets/vendor-supabase-DtuMx0jC.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
