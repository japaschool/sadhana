interface PhoneFrameProps {
  src: string
  alt: string
  accentColor?: string
}

export default function PhoneFrame({ src, alt, accentColor = '#2AC394' }: PhoneFrameProps) {
  return (
    <div
      style={{
        width: '270px',
        height: '568px',
        background: '#0A0A0A',
        borderRadius: '50px',
        padding: '10px',
        boxShadow: `
          0 0 0 1.5px rgba(255,255,255,0.11),
          0 60px 140px rgba(0,0,0,0.75),
          0 20px 50px rgba(0,0,0,0.50),
          0 0 60px ${accentColor}22
        `,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Dynamic island notch */}
      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '88px',
          height: '26px',
          background: '#0A0A0A',
          borderRadius: '13px',
          zIndex: 10,
        }}
      />

      {/* Screen */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '42px',
          overflow: 'hidden',
          background: '#111',
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          draggable={false}
        />
      </div>

      {/* Side button hints */}
      <div style={{ position: 'absolute', right: '-4px', top: '100px', width: '3px', height: '32px', background: '#1a1a1a', borderRadius: '2px' }} />
      <div style={{ position: 'absolute', left: '-4px', top: '85px',  width: '3px', height: '28px', background: '#1a1a1a', borderRadius: '2px' }} />
      <div style={{ position: 'absolute', left: '-4px', top: '125px', width: '3px', height: '48px', background: '#1a1a1a', borderRadius: '2px' }} />
      <div style={{ position: 'absolute', left: '-4px', top: '183px', width: '3px', height: '48px', background: '#1a1a1a', borderRadius: '2px' }} />
    </div>
  )
}
