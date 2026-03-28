'use client'

import { useState } from 'react'

export default function AnalyticsPage() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        System Analytics
      </h1>

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Analytics dashboard coming soon. Track system metrics, user growth, and platform usage.
        </p>
      </div>
    </div>
  )
}
