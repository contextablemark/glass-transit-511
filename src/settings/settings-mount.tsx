/**
 * Mount the React settings page into the DOM.
 * Called from main.ts — always runs (phone + browser).
 */

import { createRoot } from 'react-dom/client'
import { SettingsApp } from './SettingsApp'

export function initSettingsPage(): void {
  const el = document.getElementById('app')
  if (!el) return
  createRoot(el).render(<SettingsApp />)
}
