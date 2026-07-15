interface PhoneFrameProps {
  src: string
  alt: string
  accentColor?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { w: 230, h: 484 },
  md: { w: 290, h: 610 },
  lg: { w: 340, h: 714 },
}

export default function PhoneFrame({ src, alt, accentColor = '#3A7D5C', size = 'md' }: PhoneFrameProps) {
  const { w, h } = sizes[size]
  const radius = Math.round(w * 0.175)
  const pad = Math.round(w * 0.035)

  return (
    <div
      style={{
        width: w,
        height: h,
        background: '#0A0A0A',
        borderRadius: radius,
        padding: pad,
        boxShadow: `
          0 0 0 1.5px rgba(255,255,255,0.10),
          0 50px 120px rgba(0,0,0,0.30),
          0 20px 50px rgba(0,0,0,0.20),
          0 0 40px ${accentColor}18
        `,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Dynamic island */}
      <div style={{
        position: 'absolute',
        top: Math.round(h * 0.028),
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.round(w * 0.30),
        height: Math.round(w * 0.085),
        background: '#0A0A0A',
        borderRadius: 99,
        zIndex: 10,
      }} />

      {/* Screen */}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: radius - pad,
        overflow: 'hidden',
        background: '#111',
      }}>
        <img src={src} alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          draggable={false}
        />
      </div>

      {/* Side buttons */}
      <div style={{ position: 'absolute', right: -3, top: '17%', width: 3, height: '5%', background: '#1a1a1a', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: -3, top: '14%', width: 3, height: '5%', background: '#1a1a1a', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: -3, top: '21%', width: 3, height: '8%', background: '#1a1a1a', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: -3, top: '32%', width: 3, height: '8%', background: '#1a1a1a', borderRadius: 2 }} />
    </div>
  )
}
