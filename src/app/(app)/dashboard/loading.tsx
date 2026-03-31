export default function DashboardLoading() {
  return (
    <div style={{ maxWidth: '960px', padding: '24px 0' }}>
      {/* Welcome banner skeleton */}
      <div style={{
        height: '120px', borderRadius: '12px', marginBottom: '24px',
        background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
      }} />

      {/* Stats grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: '100px', borderRadius: '12px',
            background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>

      {/* Sessions skeleton */}
      <div style={{
        height: '200px', borderRadius: '12px', marginBottom: '24px',
        background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
        animationDelay: '0.5s',
      }} />

      {/* Activity skeleton */}
      <div style={{
        height: '180px', borderRadius: '12px',
        background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite',
        animationDelay: '0.6s',
      }} />
    </div>
  )
}
