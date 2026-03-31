export default function MessagesLoading() {
  return (
    <div style={{ maxWidth: '960px', padding: '24px 0' }}>
      {/* Conversation list skeleton */}
      <div style={{ display: 'flex', gap: '16px', height: '500px' }}>
        {/* Sidebar */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ height: '40px', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: '60px', borderRadius: '10px',
              background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>

        {/* Chat area */}
        <div style={{
          flex: 1, borderRadius: '12px',
          background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: '0.3s',
        }} />
      </div>
    </div>
  )
}
