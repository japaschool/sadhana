import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

import React from 'react'

interface Props {
  image: string
  title: string
  text: React.ReactNode
  overlay?: boolean
}

export default function ParallaxSection({ image, title, text, overlay = true }: Props) {
  const ref = useRef < HTMLDivElement > (null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Subtle movement to stay inside the container
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '5%'])

  return (
    <section
      ref={ref}
      className="relative h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background image with limited transform */}
      <motion.div
        style={{ y, backgroundImage: `url(${image})` }}
        className="absolute inset-0 bg-cover bg-center will-change-transform"
      />

      {/* Optional overlay */}
      {overlay && (
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/40 z-0" />
      )}

      {/* Foreground content */}
      <motion.div
        className="relative z-10 text-center text-white px-8"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <h2 className="text-4xl md:text-6xl font-serif mb-6 drop-shadow-lg">{title}</h2>
        {typeof text === 'string' ? (
          <p className="max-w-2xl mx-auto text-lg md:text-xl font-light leading-relaxed">
            {text}
          </p>
        ) : (
          <div className="max-w-2xl mx-auto text-lg md:text-xl font-light leading-relaxed">
            {text}
          </div>
        )}
      </motion.div>
    </section>
  )
}
