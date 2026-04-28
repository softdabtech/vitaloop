export const deviceDetection = {
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  isAndroid: () => /Android/.test(navigator.userAgent),
  isMobile: () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isTablet: () => {
    const ua = navigator.userAgent
    return /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)
  },
  isDesktop: () => !deviceDetection.isMobile() && !deviceDetection.isTablet(),
  isChrome: () => /Chrome/.test(navigator.userAgent),
  isFirefox: () => /Firefox/.test(navigator.userAgent),
  isSafari: () => /Safari/.test(navigator.userAgent),
  isOnline: () => navigator.onLine,
  isTouchDevice: () =>
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window ||
    window.matchMedia('(pointer: coarse)').matches,
  getScreenSize: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
  }),
  supports: {
    notch: () => CSS.supports('padding', 'max(0px, env(safe-area-inset-bottom))'),
    webP: () => {
      const canvas = document.createElement('canvas')
      return canvas.toDataURL('image/webp').includes('image/webp')
    },
    webWorker: () => typeof Worker !== 'undefined',
    serviceWorker: () => 'serviceWorker' in navigator,
    indexedDB: () => 'indexedDB' in window,
  },
}
