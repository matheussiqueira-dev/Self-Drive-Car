/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

(function bootstrapAnalytics() {
  const endpoint = window.NEURAL_DRIVE_ANALYTICS_ENDPOINT || "";
  const queue = [];
  const sessionId =
    (crypto && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function payloadFor(name, data = {}) {
    return {
      name,
      data,
      sessionId,
      path: location.pathname,
      href: location.href,
      ts: new Date().toISOString(),
    };
  }

  function dispatch(event) {
    queue.push(event);

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: event.name, ...event.data });
    }

    if (!endpoint) return;

    const body = JSON.stringify(event);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function track(name, data) {
    dispatch(payloadFor(name, data));
  }

  window.NeuralDriveAnalytics = {
    track,
    getQueue: () => queue.slice(),
  };

  window.addEventListener("error", (event) => {
    track("client_error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    track("unhandled_rejection", {
      message: event.reason?.message || String(event.reason || "unknown"),
    });
  });

  window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      track("page_loaded", {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
        transferSize: nav.transferSize || 0,
      });
    }
  });

  if ("PerformanceObserver" in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) track("web_vital_lcp", { value: Math.round(last.startTime) });
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    try {
      let cls = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cls += entry.value;
        }
        track("web_vital_cls", { value: Number(cls.toFixed(4)) });
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {}
  }
})();
