'use client'

export default function SettingsPage() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        System Settings
      </h1>

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          System settings panel coming soon. Configure global settings and feature flags.
        </p>
      </div>
    </div>
  )
}
