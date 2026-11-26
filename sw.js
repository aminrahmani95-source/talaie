/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-b41d3aad81d5';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-BZZpuz9b.js","./assets/CeoMasterRegistry-CxcerXp5.js","./assets/DailyLogModal-DVBvBub0.js","./assets/FailedOperationsModal-XKcHgk5_.js","./assets/HandoverCertificateModal-CkpT3_F8.js","./assets/IssuesDesk-BfgmxGqu.js","./assets/MaterialCenter-BYpbV68x.js","./assets/MaterialRequestModal-CA_Z1FrZ.js","./assets/MeasurementDashboard-CLwWBDVK.js","./assets/MonthPlanner-aF93y3Kl.js","./assets/OperationsControlCenter-Cj8bazde.js","./assets/PageHeader-BybD3Ela.js","./assets/PendingOperationsModal-B6mtgKH8.js","./assets/PersonnelEvaluationModal-DAOnnteV.js","./assets/PreInstallationModal-gQqVPM3n.js","./assets/ProductCountsInput-IHx7vFGf.js","./assets/ProjectDossierModal-CCa65sMR.js","./assets/ProjectFormModal-BVALwU5-.js","./assets/ProjectManagerSheet-B42b3Nls.js","./assets/ProjectPassportPrint-DfbVgiT3.js","./assets/ProjectsHub-DDzxWxB2.js","./assets/ProposalViewerModal-AbHSFdXy.js","./assets/QcDesk-BKUlwn3V.js","./assets/ReportCompletionModal-DAB-9IxB.js","./assets/ReportStuckModal-CPgs0vFT.js","./assets/SalesPortal-BvpYNc_X.js","./assets/SegmentedControl-BDOcW5_A.js","./assets/SettingsView-BIxIaaWA.js","./assets/StuckProjectsDesk-Dy3SdYKN.js","./assets/TechniciansManager-xxZ8G17o.js","./assets/TicketCenter-Cuvyn-iL.js","./assets/TicketModal-C4yBtEC3.js","./assets/Toast-DtsbdNGI.js","./assets/ToolChecklistDrawer-BAI3I7yv.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-EqxFV4T2.js","./assets/WarehouseStageBadge-B001LVpV.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-BkJs7mCH.css","./assets/index-CSTv_z0g.js","./assets/jalali-CqqLjkQB.js","./assets/multiDay-C4R2NnHG.js","./assets/navCounts-CtZ8aN7C.js","./assets/nextStep-BmKGi7ww.js","./assets/offlineQueue-EuwI5ZRY.js","./assets/planProgress-Ctq-_xCP.js","./assets/preload-helper-CRzLMJPS.js","./assets/productCounts-exOsHdLc.js","./assets/qcWorkflow-DrqPQ7PU.js","./assets/rolldown-runtime-COiEfhsA.js","./assets/salesCapacity-cPfhRo5j.js","./assets/sla-Chs2xu3a.js","./assets/supabase-CisPfjfU.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/technicianName-DUTmhJF6.js","./assets/ui-CBV4_7ZO.js","./assets/useToday-B2Ci3_fF.js","./assets/vendor-icons-BJxNYEBq.js","./assets/vendor-react-TO3cgmuO.js","./assets/vendor-supabase-DtuMx0jC.js","./assets/warehouseHistory-mXTqpYHH.js","./assets/xlsxReports-Brp48rUL.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
