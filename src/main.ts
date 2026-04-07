/**
 * Glass Transit — main entry point.
 *
 * Dual-mode bootstrap (same pattern as SubwayLens):
 * - Phone screen: settings page (React) — always shown
 * - Glasses display: real-time departures — only inside Even App WebView
 */

import { initSettingsPage } from './settings/settings-mount'

async function main(): Promise<void> {
  // Always show settings page on phone screen
  initSettingsPage()

  // Check if inside Even App WebView
  const hasFlutter =
    !!(window as any).flutter_inappwebview ||
    !!(window as any).webkit?.messageHandlers?.callHandler

  if (hasFlutter) {
    // Glasses mode will be wired up in a later phase
    const { waitForEvenAppBridge } = await import(
      '@evenrealities/even_hub_sdk'
    )
    try {
      const bridge = await waitForEvenAppBridge()
      const { startGlassesMode } = await import('./glasses/boot')
      await startGlassesMode(bridge)
    } catch {
      console.warn('Glasses mode failed, settings page still available')
    }
  }
}

main()
