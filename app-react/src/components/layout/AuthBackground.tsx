export function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10" style={{ background: '#1a1f27' }}>
      {/* Backdrop photo (bg1 — zen stones), full-bleed cover. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.webp')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark filter (static-site style: darker top/bottom, lighter middle) —
          moody, but the painting still reads clearly. Tune these alphas to taste. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.30) 100%)',
        }}
      />
    </div>
  )
}
