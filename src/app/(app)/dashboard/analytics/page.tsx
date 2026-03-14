'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import Button from '@/components/ui/Button'
import { BarChart2, Bell, TrendingUp, Users, Clock, Video } from 'lucide-react'

export default function AnalyticsPage() {
  const user = useAppStore(s => s.user)
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Placeholder stat cards (zeroed out)
  const STATS = [
    { label: 'Total Sessions',    value: '—', icon: Video,     color: 'var(--primary-400)', bg: 'rgba(99,102,241,0.1)'  },
    { label: 'Total Students',    value: '—', icon: Users,     color: 'var(--success-400)', bg: 'rgba(34,197,94,0.1)'   },
    { label: 'Avg. Session Time', value: '—', icon: Clock,     color: 'var(--info-400)',    bg: 'rgba(59,130,246,0.1)'  },
    { label: 'Engagement Rate',   value: '—', icon: TrendingUp,color: 'var(--accent-400)',  bg: 'rgba(168,85,247,0.1)'  },
  ]

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Track engagement, attendance, and learning outcomes
          </p>
        </div>
        <Button variant="outline" icon={<Bell size={15} />} onClick={() => notify('🔔 We\'ll notify you when Analytics launches!')}>
          Notify Me
        </Button>
      </div>

      {/* Placeholder stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {STATS.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card" style={{ padding: '20px', opacity: 0.6 }}>
              <div style={{ width: 40, height: 40, background: stat.bg, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={18} color={stat.color} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* Main coming soon card */}
      <div className="card" style={{ padding: '56px 40px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <BarChart2 size={34} color="var(--primary-400)" />
        </div>

        <h2 style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Analytics dashboard coming soon</h2>
        <p style={{ margin: '0 0 32px', fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Get deep insights into session attendance, student engagement, quiz scores, and teaching patterns.
        </p>

        {/* Planned features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', textAlign: 'left' }}>
          {[
            { emoji: '📈', title: 'Attendance Charts',  desc: 'See who joins and for how long' },
            { emoji: '🎯', title: 'Quiz Performance',   desc: 'Average scores per quiz and student' },
            { emoji: '⏱️', title: 'Session Duration',   desc: 'Track teaching hours over time' },
            { emoji: '🏆', title: 'Top Students',       desc: 'Recognise most engaged learners' },
          ].map(f => (
            <div key={f.title} style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: '6px' }}>{f.emoji}</div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{f.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {toast && <div className="toast toast-info" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

