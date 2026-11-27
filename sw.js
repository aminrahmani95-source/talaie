/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-3348db0c2190';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-Bp0QdMog.js","./assets/CeoMasterRegistry-Drk0nFxf.js","./assets/CoordinatorWarehouseView-8nweOdvi.js","./assets/DailyLogModal-DA2oK6bY.js","./assets/EmptyState-DBmwJFKc.js","./assets/FailedOperationsModal-C6xFdrmD.js","./assets/HandoverCertificateModal-5WvOZooZ.js","./assets/IssuesDesk-Jx-f8yWL.js","./assets/MaterialCenter-rKv1uqwJ.js","./assets/MaterialRequestModal-dyHVExWi.js","./assets/MeasurementDashboard-CJ9JE-H8.js","./assets/MonthPlanner-mwvh6LQB.js","./assets/OperationsControlCenter-B4o-xGw8.js","./assets/PageHeader-BybD3Ela.js","./assets/PendingOperationsModal-C-A6jDi1.js","./assets/PersonnelEvaluationModal-BWeS_lRQ.js","./assets/PreInstallationModal-ChlbKRI0.js","./assets/ProductCountsInput-D7GUesvm.js","./assets/ProjectDossierModal-Fx4T5WjF.js","./assets/ProjectFormModal-XCltpwXB.js","./assets/ProjectManagerSheet-CuugZWmv.js","./assets/ProjectPassportPrint-Dzi4jaRA.js","./assets/ProjectsHub-DkBgIW2m.js","./assets/ProposalViewerModal-CpaPN-w5.js","./assets/QcDesk-DGKJeRuS.js","./assets/ReportCompletionModal-DUdPxUfP.js","./assets/ReportStuckModal-DZ_idE55.js","./assets/SalesPortal-CzL_b-qP.js","./assets/SegmentedControl-BDOcW5_A.js","./assets/SettingsView-CqzrNVqi.js","./assets/StuckProjectsDesk-D199UDhQ.js","./assets/TechniciansManager-BTj0-xLK.js","./assets/TicketCenter-koGMkPVz.js","./assets/TicketModal-B9fpGqCT.js","./assets/Toast-CQJzc3B0.js","./assets/ToolChecklistDrawer-Bs5SG3QC.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-CxJO0bKN.js","./assets/WarehouseStageBadge-s2ER_3Sc.js","./assets/backup-N46-P7wJ.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-CfqOSVb9.js","./assets/index-CnDlBzNQ.css","./assets/jalali-DuJfGmYl.js","./assets/multiDay-DHAWPrFg.js","./assets/navCounts-B5Ojng8Y.js","./assets/nextStep-DttS44nP.js","./assets/offlineQueue-EuwI5ZRY.js","./assets/planProgress-Ctq-_xCP.js","./assets/preload-helper-CRzLMJPS.js","./assets/productCounts-Cn_X4wLF.js","./assets/qcWorkflow-GtFKsH_D.js","./assets/rolldown-runtime-COiEfhsA.js","./assets/salesCapacity-BwLYeD7Z.js","./assets/sla-Chs2xu3a.js","./assets/supabase-BaRKO_me.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/technicianName-DUTmhJF6.js","./assets/ui-BQaHxFIt.js","./assets/useToday-RqTGufnz.js","./assets/vendor-icons-CC5ThvWO.js","./assets/vendor-react-TO3cgmuO.js","./assets/vendor-supabase-DtuMx0jC.js","./assets/warehouseHistory-DuMb5ryK.js","./assets/xlsxReports-B8utAl-C.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
