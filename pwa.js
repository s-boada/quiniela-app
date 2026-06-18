(function () {
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function getInstallButton() {
    return document.getElementById("pwaInstallBtn");
  }

  function showInstallButton() {
    const btn = getInstallButton();
    if (btn) btn.style.display = "inline-flex";
  }

  function hideInstallButton() {
    const btn = getInstallButton();
    if (btn) btn.style.display = "none";
  }

  window.installQuinielaApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    hideInstallButton();
    if (outcome === "accepted") {
      console.log("PWA instalada");
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone()) showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
        console.warn("No se pudo registrar el service worker:", error);
      });
    });
  }

  if (isStandalone()) hideInstallButton();
})();
