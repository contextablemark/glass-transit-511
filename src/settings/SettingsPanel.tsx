/**
 * Settings panel — proxy URL, API key (optional BYOK), refresh interval.
 */

import type { Settings } from '../types'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
}

const INTERVALS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '2m', value: 120 },
]

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

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Proxy URL */}
      <div>
        <label style={labelStyle}>
          Transit Proxy URL
        </label>
        <input
          type="text"
          placeholder="https://your-proxy.workers.dev"
          value={settings.proxyBaseUrl}
          onChange={(e) =>
            onChange({ ...settings, proxyBaseUrl: e.target.value })
          }
          style={inputStyle}
        />
        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>
          Leave empty for local dev. In production, enter your proxy URL.
        </div>
      </div>

      {/* API Key (optional BYOK) */}
      <div>
        <label style={labelStyle}>
          511.org API Key (optional)
        </label>
        <input
          type="password"
          placeholder="Leave empty to use community proxy"
          value={settings.apiKey}
          onChange={(e) =>
            onChange({ ...settings, apiKey: e.target.value })
          }
          style={inputStyle}
        />
        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>
          Optional. If set, uses your own key via POST. If empty, uses community
          GET mode (CDN-cached).{' '}
          <a
            href="https://511.org/open-data"
            target="_blank"
            rel="noopener"
            style={{ color: '#6699cc' }}
          >
            Get a free key
          </a>
        </div>
      </div>

      {/* Refresh Interval */}
      <div>
        <label style={labelStyle}>Refresh Interval</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() =>
                onChange({ ...settings, refreshInterval: value })
              }
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.85rem',
                background:
                  settings.refreshInterval === value
                    ? '#e0e0e0'
                    : '#252540',
                color:
                  settings.refreshInterval === value
                    ? '#1a1a2e'
                    : '#e0e0e0',
                border: '1px solid #444',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight:
                  settings.refreshInterval === value ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
