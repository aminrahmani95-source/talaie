/* Talaei service worker — generated at build time. Do not edit by hand. */
const CACHE = 'talaie-shell-20958bdb3a74';
const PRECACHE = ["./","./apple-touch-icon.png","./assets/Button-DhoCuvy0.js","./assets/CeoMasterRegistry-dS1SRnyz.js","./assets/DailyLogModal-C31AqqxG.js","./assets/FailedOperationsModal-wEF31olx.js","./assets/HandoverCertificateModal-BJxK11nX.js","./assets/IssuesDesk-hqKLkis8.js","./assets/MaterialCenter-D8uK1jcI.js","./assets/MaterialRequestModal-btY5o0Jv.js","./assets/MeasurementDashboard-BwFZuQgY.js","./assets/MonthPlanner-CSeUz9GM.js","./assets/OperationsControlCenter-9eWN_Dfn.js","./assets/PageHeader-BF3kQBtY.js","./assets/PendingOperationsModal-BrtYeZT7.js","./assets/PersonnelEvaluationModal-BO16RJLb.js","./assets/PreInstallationModal-J8dCLF9K.js","./assets/ProductCountsInput-H1W2nYh4.js","./assets/ProjectDossierModal-CNjZzHtb.js","./assets/ProjectFormModal-DgIQ7X3A.js","./assets/ProjectManagerSheet-Dd85rSvf.js","./assets/ProjectPassportPrint-BLPBsWGf.js","./assets/ProjectsHub-o2LQReaY.js","./assets/ProposalViewerModal-DLIEMp2Y.js","./assets/QcDesk-RjmynKVC.js","./assets/ReportCompletionModal-CDcjdSKg.js","./assets/ReportStuckModal-BZYy8Ihq.js","./assets/SalesPortal-D5FM445D.js","./assets/SegmentedControl-ZcmV7ZYH.js","./assets/SettingsView-CuzM6t9W.js","./assets/StuckProjectsDesk-B4m7VjtE.js","./assets/TechniciansManager-s1-azyP2.js","./assets/TicketCenter-Cd8zJT5g.js","./assets/TicketModal-CeWQBUUe.js","./assets/ToolChecklistDrawer-BcVspKwe.js","./assets/Vazirmatn-Bold-_OhAJEdh.woff2","./assets/Vazirmatn-ExtraBold-DCjt2qDm.woff2","./assets/Vazirmatn-Medium-D86t5Axy.woff2","./assets/Vazirmatn-Regular-CtGL0YI-.woff2","./assets/WarehouseDesk-Cp3u0eyk.js","./assets/WarehouseStageBadge-B2pCRe1l.js","./assets/confetti.module-CAXNRs-2.js","./assets/heic-to-D_6jDjAg.js","./assets/index-DUsmQKMD.js","./assets/index-z68Jkwl8.css","./assets/jalali-l_1RpdOI.js","./assets/nextStep-9hx6TJsy.js","./assets/offlineQueue-EuwI5ZRY.js","./assets/qcWorkflow-DEIag3Wg.js","./assets/sla-Chs2xu3a.js","./assets/talaei-lion-gold-CJjLNXVc.png","./assets/talaei-lion-white-CYJkoG80.png","./assets/useToday-BB37s43v.js","./assets/vendor-icons-BUVOJ-Mc.js","./assets/vendor-react-DPs9BA7L.js","./assets/vendor-supabase-DtuMx0jC.js","./assets/warehouseHistory-ZPvkfV4g.js","./badge-96.png","./black.webp","./favicon-16x16.png","./favicon-32x32.png","./favicon.svg","./fonts/Vazirmatn-Bold.woff2","./fonts/Vazirmatn-ExtraBold.woff2","./fonts/Vazirmatn-Medium.woff2","./fonts/Vazirmatn-Regular.woff2","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icons.svg","./logo.webp","./logo2.webp","./manifest.json","./talaei-lion-gold.png","./talaei-lion-white.png","./talaei-lion.png","./user_uploaded_logo.png","./white.webp"];

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
