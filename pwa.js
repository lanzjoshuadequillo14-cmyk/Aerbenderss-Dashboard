let deferredInstallPrompt = null;
const installButton = document.getElementById('install-app-btn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(error => {
      console.error('PWA service worker registration failed:', error);
    });
  });
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showInstallButton() {
  if (installButton && !isStandaloneApp()) installButton.hidden = false;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallButton();
});

installButton?.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    return;
  }

  if (isIosDevice()) {
    window.alert('To install AeroCube, tap Share in Safari, then choose Add to Home Screen.');
  } else {
    window.alert('Use your browser menu and choose Install AeroCube or Add to Home Screen.');
  }
});

window.addEventListener('appinstalled', () => {
  if (installButton) installButton.hidden = true;
});

if (isIosDevice()) showInstallButton();
