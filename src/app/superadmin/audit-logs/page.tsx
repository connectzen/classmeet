'use client'

import { useState, useEffect } from 'react'
import type { SuperAdminAuditLog } from '@/lib/supabase/types'

async function fetchAuditLogs(action?: string, days?: number): Promise<any[]> {
  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (days) params.set('days', days.toString())

  const res = await fetch(`/api/superadmin/audit-logs?${params}`)
  if (!res.ok) throw new Error('Failed to fetch audit logs')
  const { data } = await res.json()
  return data
}

const ACTIONS = [
  'create_school',
  'update_school',
  'delete_school',
  'create_user',
  'update_user',
  'delete_user',
  'change_role',
]

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [days, setDays] = useState(7)

  useEffect(() => {
    setLoading(true)
    fetchAuditLogs(action || undefined, days || undefined)
      .then(setLogs)
      .catch((err) => {
        console.error('Error loading audit logs:', err)
      })
      .finally(() => setLoading(false))
  }, [action, days])

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Audit Logs
      </h1>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
            Action
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
            Time Range
          </label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No audit logs found.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Admin
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Action
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Target Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                    {log.super_admin?.full_name || 'Unknown'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {log.action.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {log.target_type || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
