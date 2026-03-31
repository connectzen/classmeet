export default function RoomsLoading() {
  return (
    <div style={{ maxWidth: '960px', padding: '24px 0' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ width: '200px', height: '32px', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '140px', height: '36px', borderRadius: '8px', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>

      {/* Room cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: '180px', borderRadius: '12px',
            background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
