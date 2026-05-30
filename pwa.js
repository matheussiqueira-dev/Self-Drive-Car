/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

(function bootstrapPwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => {
        window.NeuralDriveAnalytics?.track("pwa_registered", {
          scope: registration.scope,
        });
      })
      .catch((error) => {
        window.NeuralDriveAnalytics?.track("pwa_registration_failed", {
          message: error.message,
        });
      });
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    window.NeuralDriveAnalytics?.track("pwa_install_prompt", {
      platforms: event.platforms || [],
    });
  });

  window.addEventListener("appinstalled", () => {
    window.NeuralDriveAnalytics?.track("pwa_installed");
  });
})();
