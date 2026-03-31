export default function MembersLoading() {
  return (
    <div style={{ maxWidth: '960px', padding: '24px 0' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ width: '160px', height: '32px', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '140px', height: '36px', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>

      {/* Member rows skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            height: '64px', borderRadius: '10px',
            background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.08}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
