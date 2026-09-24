import api from './api.js'

const WIDGET_SCRIPT_SRC = 'https://secure.wayforpay.com/server/pay-widget.js'

let widgetScriptPromise = null

// Loads WayForPay's popup checkout widget once, reused across calls. The
// widget collects card details on WayForPay's own page -- our page never
// touches raw card data, so no PCI DSS scope lands on us (see
// https://wiki.wayforpay.com/uk/view/852091).
function loadWidgetScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.Wayforpay) return Promise.resolve()
  if (widgetScriptPromise) return widgetScriptPromise

  widgetScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('widget-wfp-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('WayForPay widget script failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = 'widget-wfp-script'
    script.src = WIDGET_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('WayForPay widget script failed to load'))
    document.head.appendChild(script)
  })
  return widgetScriptPromise
}

/**
 * Opens the WayForPay popup checkout for a Premium plan.
 *
 * @param {'monthly'|'yearly'} plan
 * @param {{onApproved?: () => void, onDeclined?: (reason: string) => void, onPending?: () => void, onClose?: () => void}} handlers
 *
 * The signed payload (merchantSignature already computed server-side, the
 * secret key itself never sent to the browser) comes from POST
 * /wayforpay/checkout -- see backend/app/routers/billing/wayforpay.py.
 *
 * onClose fires when the user closes the popup without paying -- the
 * widget's own run() callbacks (approved/declined/pending) never fire in
 * that case, only the WfpWidgetEventClose postMessage does (see the
 * widget docs), so a caller relying only on run()'s callbacks to clear a
 * "checkout in progress" state would get stuck there on a plain close.
 */
export async function openWayforpayCheckout(plan, handlers = {}) {
  const { onApproved, onDeclined, onPending, onClose } = handlers

  const [{ data: payload }] = await Promise.all([
    api.post('/wayforpay/checkout', { plan }),
    loadWidgetScript(),
  ])

  let settled = false
  let guardActive = false
  const removeGuard = () => {
    if (!guardActive) return
    guardActive = false
    window.removeEventListener('popstate', onPopState)
  }
  const settleOnce = (fn) => (...args) => {
    if (settled) return
    settled = true
    window.removeEventListener('message', onMessage)
    removeGuard()
    fn?.(...args)
  }
  const approved = settleOnce(onApproved)
  const declined = settleOnce(onDeclined)
  const pending = settleOnce(onPending)
  const closed = settleOnce(onClose)

  function onMessage(event) {
    if (event.data === 'WfpWidgetEventClose') closed()
  }
  window.addEventListener('message', onMessage)

  // The widget renders its own overlay/iframe outside React's root. A
  // browser/gesture "back" while it's open would otherwise pop the SPA
  // route out from under it (stranding the overlay on screen with nothing
  // to close it) instead of returning the user to this page -- push a
  // throwaway history entry so back closes the widget in place instead.
  history.pushState({ wfpCheckoutGuard: true }, '', window.location.href)
  function onPopState() {
    history.pushState({ wfpCheckoutGuard: true }, '', window.location.href)
    closed()
  }
  window.addEventListener('popstate', onPopState)
  guardActive = true

  const wayforpay = new window.Wayforpay()
  wayforpay.run(
    payload,
    () => approved(),
    (response) => declined(response?.reason || response?.reasonCode || 'declined'),
    () => pending(),
  )
}
