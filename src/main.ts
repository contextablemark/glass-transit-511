/**
 * Glass Transit 511 — main entry point.
 *
 * Dual-mode bootstrap (same pattern as SubwayLens):
 * - Phone screen: settings page (React) — always shown
 * - Glasses display: real-time departures — only inside Even App WebView
 *
 * Storage is initialized before mounting the settings page when running
 * inside the Even App WebView, so favorites persist via bridge storage.
 */

import { initStorage } from './lib/storage'
import { initSettingsPage } from './settings/settings-mount'

/** Send a log message to the Vite dev server terminal. */
function devLog(msg: string) {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg }),
    }).catch(() => {})
  }
}

async function main(): Promise<void> {
  // Check if inside Even App WebView
  const hasFlutter =
    !!(window as any).flutter_inappwebview ||
    !!(window as any).webkit?.messageHandlers?.callHandler

  devLog(`hasFlutter: ${hasFlutter}`)

  if (hasFlutter) {
    try {
      devLog('waiting for bridge...')
      const { waitForEvenAppBridge } = await import(
        '@evenrealities/even_hub_sdk'
      )
      const bridge = await waitForEvenAppBridge()
      devLog('bridge ready, starting glasses mode')

      // Init storage BEFORE mounting settings so favorites load from bridge
      initStorage(bridge)

      // Mount settings page (will read from bridge storage now)
      initSettingsPage()

      // Start glasses mode
      const { startGlassesMode } = await import('./glasses/boot')
      await startGlassesMode(bridge)
    } catch {
      // Bridge failed — fall back to browser-only mode
      devLog('Glasses mode FAILED, settings page still available')
      initSettingsPage()
    }
  } else {
    // Browser mode — no bridge, localStorage only
    initSettingsPage()
  }
}

main()
