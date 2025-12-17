import { motion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

interface Slide {
  image: string
  text: string
}

interface CarouselProps {
  slides: Slide[]
  className?: string
}

export default function Carousel({ slides, className }: CarouselProps) {
  const [index, setIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    setWidth(containerRef.current.offsetWidth)

    const onResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth)
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const next = () => setIndex((i) => Math.min(i + 1, slides.length - 1))
  const prev = () => setIndex((i) => Math.max(i - 1, 0))

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {/* Track */}
      <motion.div
        className="flex"
        animate={{ x: -index * width }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        drag="x"
        dragConstraints={{ left: -(slides.length - 1) * width, right: 0 }}
        dragElastic={0.15}
        dragDirectionLock
        onDragEnd={(e, info) => {
          if (info.offset.x < -width * 0.2) next()
          if (info.offset.x > width * 0.2) prev()
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="shrink-0 w-full flex flex-col items-center justify-center px-6"
          >
            <p className="m-6 max-w-md text-center text-white/90 text-base md:text-lg font-light">
              {slide.text}
            </p>
            <img
              src={slide.image}
              className="max-h-[65vh] rounded-xl shadow-2xl select-none"
              draggable={false}
            />
          </div>
        ))}
      </motion.div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 text-4xl text-white/80 hover:text-white"
      >
        ‹
      </button>
      <button
        onClick={next}
        className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 text-4xl text-white/80 hover:text-white"
      >
        ›
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-2.5 h-2.5 rounded-full transition ${
              i === index ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
