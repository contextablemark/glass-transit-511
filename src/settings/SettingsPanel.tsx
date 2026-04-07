/**
 * Settings panel.
 *
 * - BART API key (optional but recommended) + refresh interval
 * - Advanced: GTFS-RT proxy URL, 511.org API key, refresh interval
 */

import { useState } from 'react'
import type { Settings } from '../types'
// No demo key baked in — user registers their own

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '0.9rem',
  background: '#252540',
  color: '#e0e0e0',
  border: '1px solid #444',
  borderRadius: '0.5rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#999',
  marginBottom: '0.25rem',
  display: 'block',
}

const hintStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#666',
  marginTop: '0.2rem',
}

function IntervalPicker({
  value,
  options,
  onChange,
}: {
  value: number
  options: Array<{ label: string; value: number }>
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {options.map(({ label, value: v }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1,
            padding: '0.5rem',
            fontSize: '0.85rem',
            background: value === v ? '#e0e0e0' : '#252540',
            color: value === v ? '#1a1a2e' : '#e0e0e0',
            border: '1px solid #444',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: value === v ? 600 : 400,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(settings.proxyBaseUrl || settings.gtfsApiKey)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* ── BART Settings ── */}
      <div>
        <label style={labelStyle}>BART API Key (optional but recommended)</label>
        <input
          type="text"
          placeholder="Enter your BART API key"
          value={settings.bartApiKey}
          onChange={(e) =>
            onChange({ ...settings, bartApiKey: e.target.value })
          }
          style={inputStyle}
        />
        <div style={hintStyle}>
          Enables richer BART data (car count, platform). Register at{' '}
          <a href="https://api.bart.gov/api/register.aspx" target="_blank" rel="noopener"
            style={{ color: '#6699cc' }}>api.bart.gov</a>
          {'. '}Without this, BART uses GTFS-RT (requires proxy below).
        </div>
      </div>

      <div>
        <label style={labelStyle}>BART Refresh Interval</label>
        <IntervalPicker
          value={settings.bartRefreshSec}
          options={[
            { label: '15s', value: 15 },
            { label: '30s', value: 30 },
            { label: '60s', value: 60 },
          ]}
          onChange={(v) => onChange({ ...settings, bartRefreshSec: v })}
        />
      </div>

      {/* ── Advanced / GTFS-RT ── */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6699cc',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: 0,
          }}
        >
          {showAdvanced ? '▾' : '▸'} Advanced (Muni / GTFS-RT)
        </button>
      </div>

      {showAdvanced && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          padding: '0.75rem',
          background: '#1e1e35',
          borderRadius: '0.5rem',
          border: '1px solid #333',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#999' }}>
            Required for Muni stations. Also provides BART fallback if the legacy API is unavailable.
          </div>

          <div>
            <label style={labelStyle}>Transit Proxy URL</label>
            <input
              type="text"
              placeholder="https://your-proxy.workers.dev"
              value={settings.proxyBaseUrl}
              onChange={(e) =>
                onChange({ ...settings, proxyBaseUrl: e.target.value })
              }
              style={inputStyle}
            />
            <div style={hintStyle}>
              Leave empty for local dev. See proxy/README.md for setup.
            </div>
          </div>

          <div>
            <label style={labelStyle}>511.org API Key (optional)</label>
            <input
              type="password"
              placeholder="Leave empty for community proxy"
              value={settings.gtfsApiKey}
              onChange={(e) =>
                onChange({ ...settings, gtfsApiKey: e.target.value })
              }
              style={inputStyle}
            />
            <div style={hintStyle}>
              If set, uses your own key via POST. If empty, uses community GET (CDN-cached).{' '}
              <a href="https://511.org/open-data" target="_blank" rel="noopener"
                style={{ color: '#6699cc' }}>Get a free key</a>
            </div>
          </div>

          <div>
            <label style={labelStyle}>GTFS-RT Refresh Interval</label>
            <IntervalPicker
              value={settings.gtfsRefreshSec}
              options={[
                { label: '30s', value: 30 },
                { label: '60s', value: 60 },
                { label: '2m', value: 120 },
              ]}
              onChange={(v) => onChange({ ...settings, gtfsRefreshSec: v })}
            />
            <div style={hintStyle}>
              511.org allows 60 requests/hour. Longer intervals conserve quota.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
