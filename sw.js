/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-ffd80f9317d6';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-CoibHphc.js","./assets/CeoMasterRegistry-B0s43w74.js","./assets/CoordinatorWarehouseView-CLO5Gy6S.js","./assets/DailyLogModal-Dojk5yul.js","./assets/EmptyState-CXBGPekv.js","./assets/FailedOperationsModal-CfWGlOpC.js","./assets/HandoverCertificateModal-CCslEer9.js","./assets/IssuesDesk-DhkSWQkP.js","./assets/MaterialCenter-DexzJals.js","./assets/MaterialRequestModal-fcua2Ulm.js","./assets/MeasurementDashboard-C8IWKxQf.js","./assets/MonthPlanner-mFnk50zV.js","./assets/OperationsControlCenter-C2lwWYfV.js","./assets/PageHeader-BybD3Ela.js","./assets/PendingOperationsModal-DAcThChx.js","./assets/PersonnelEvaluationModal-DtNVm5eG.js","./assets/PreInstallationModal-ZTxdq7Sa.js","./assets/ProductCountsInput-DGAhyS6h.js","./assets/ProjectDossierModal-Db8vs1ui.js","./assets/ProjectFormModal-C_HihcHq.js","./assets/ProjectManagerSheet--tNpO6cg.js","./assets/ProjectPassportPrint-CHW_1dGA.js","./assets/ProjectsHub-CrMdv8DS.js","./assets/ProposalViewerModal-CzVe5UEZ.js","./assets/QcDesk-DKVkCVtG.js","./assets/ReportCompletionModal-CrTpxoDH.js","./assets/ReportStuckModal-BLxNCWOS.js","./assets/SalesPortal-w56OlAHs.js","./assets/SegmentedControl-BDOcW5_A.js","./assets/SettingsView-BwCP4GaD.js","./assets/StuckProjectsDesk-BELbKjX3.js","./assets/TechniciansManager-DYPJOJ__.js","./assets/TicketCenter-BNK-f9SU.js","./assets/TicketModal-B86CBUgz.js","./assets/Toast-Cxc5WJ_6.js","./assets/ToolChecklistDrawer-C7GBlZr4.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-CVoDHerb.js","./assets/WarehouseStageBadge-BP1JdA4s.js","./assets/backup-N46-P7wJ.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-BthSdd7c.js","./assets/index-Cc5MQq3x.css","./assets/jalali-DuJfGmYl.js","./assets/multiDay-DHAWPrFg.js","./assets/navCounts-B5Ojng8Y.js","./assets/nextStep-CyeqLvQA.js","./assets/offlineQueue-EuwI5ZRY.js","./assets/planProgress-Ctq-_xCP.js","./assets/preload-helper-CRzLMJPS.js","./assets/productCounts-Cn_X4wLF.js","./assets/qcWorkflow-GtFKsH_D.js","./assets/rolldown-runtime-COiEfhsA.js","./assets/salesCapacity-BwLYeD7Z.js","./assets/sla-Chs2xu3a.js","./assets/supabase-BaRKO_me.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/technicianName-DUTmhJF6.js","./assets/ui-Ceeep_4u.js","./assets/useToday-RqTGufnz.js","./assets/vendor-icons-8m4r4eyG.js","./assets/vendor-react-TO3cgmuO.js","./assets/vendor-supabase-DtuMx0jC.js","./assets/warehouseHistory-LoA9FYlh.js","./assets/xlsxReports-C8dAcUIu.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
