'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { MessageSquare, Bell, Send } from 'lucide-react'

export default function MessagesPage() {
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Messages</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Real-time chat between teachers and students
        </p>
      </div>

      <div className="card" style={{ padding: '64px 40px', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={34} color="var(--primary-400)" />
          </div>
          <div style={{ position: 'absolute', top: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 700 }}>✦</span>
          </div>
        </div>

        <h2 style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Messaging is coming soon</h2>
        <p style={{ margin: '0 0 32px', fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Direct messages, group chats, and in-room chat will all live here. Powered by Supabase Realtime.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button icon={<Bell size={15} />} onClick={() => notify('🔔 We\'ll notify you when Messages launches!')}>
            Notify Me
          </Button>
          <Button variant="outline" icon={<Send size={15} />} onClick={() => notify('✨ Message preview — coming soon!')}>
            Preview Feature
          </Button>
        </div>

        {/* Planned features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '40px', textAlign: 'left' }}>
          {[
            { emoji: '💬', title: 'Direct Messages', desc: 'One-on-one chat between teacher & student' },
            { emoji: '👥', title: 'Group Chats',      desc: 'Course and classroom-wide discussions' },
            { emoji: '📎', title: 'File Sharing',     desc: 'Share notes, slides, and assignments' },
            { emoji: '⚡', title: 'Real-time',        desc: 'Instant delivery with Supabase Realtime' },
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

