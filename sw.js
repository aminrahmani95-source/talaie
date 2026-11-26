/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-c0ba655af44e';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-CaulKunI.js","./assets/CeoMasterRegistry-BcpjRduE.js","./assets/DailyLogModal-DCB8BC_b.js","./assets/FailedOperationsModal-DSotX1_b.js","./assets/HandoverCertificateModal-B0pth3l7.js","./assets/IssuesDesk-CdrN8e-a.js","./assets/MaterialCenter-BmCFf_Jd.js","./assets/MaterialRequestModal-D3EOLVBn.js","./assets/MeasurementDashboard-BuAYKHtT.js","./assets/MonthPlanner-emMyL6SF.js","./assets/OperationsControlCenter-eJPAxYjh.js","./assets/PageHeader-BybD3Ela.js","./assets/PendingOperationsModal-Ba1pfLvI.js","./assets/PersonnelEvaluationModal-Do8e86DO.js","./assets/PreInstallationModal-huztF_FS.js","./assets/ProductCountsInput-Dsjsmc-F.js","./assets/ProjectDossierModal-B_I1Lgo2.js","./assets/ProjectFormModal-cvM5jnk8.js","./assets/ProjectManagerSheet-DbnB7ptT.js","./assets/ProjectPassportPrint-DpJN2LHL.js","./assets/ProjectsHub-CY13Q4jF.js","./assets/ProposalViewerModal-T4ZfmnEl.js","./assets/QcDesk-oyjsKRaQ.js","./assets/ReportCompletionModal-CVJlgyDC.js","./assets/ReportStuckModal-DEk7b2bc.js","./assets/SalesPortal-BpBy-Nad.js","./assets/SegmentedControl-BDOcW5_A.js","./assets/SettingsView-B3JyVAlF.js","./assets/StuckProjectsDesk-R2Actgyw.js","./assets/TechniciansManager-BDBJRchQ.js","./assets/TicketCenter-BhcLkTgm.js","./assets/TicketModal-DLvzP1ia.js","./assets/Toast-B4vybCQr.js","./assets/ToolChecklistDrawer-xnoRu1nD.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-BjZo5Gzo.js","./assets/WarehouseStageBadge-CM6sRV_F.js","./assets/backup-N46-P7wJ.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-DpYMbb50.js","./assets/index-NlbbWvqT.css","./assets/jalali-CqqLjkQB.js","./assets/multiDay-C4R2NnHG.js","./assets/navCounts-CtZ8aN7C.js","./assets/nextStep-QUj6tYST.js","./assets/offlineQueue-EuwI5ZRY.js","./assets/planProgress-Ctq-_xCP.js","./assets/preload-helper-CRzLMJPS.js","./assets/productCounts-exOsHdLc.js","./assets/qcWorkflow-DrqPQ7PU.js","./assets/rolldown-runtime-COiEfhsA.js","./assets/salesCapacity-cPfhRo5j.js","./assets/sla-Chs2xu3a.js","./assets/supabase-Dc_2nuLN.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/technicianName-DUTmhJF6.js","./assets/ui-CoTeuzkx.js","./assets/useToday-B2Ci3_fF.js","./assets/vendor-icons-Lcz0dmaI.js","./assets/vendor-react-TO3cgmuO.js","./assets/vendor-supabase-DtuMx0jC.js","./assets/warehouseHistory-Djl6fljf.js","./assets/xlsxReports-DPZjb0ix.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
