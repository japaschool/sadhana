import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Carousel from './Carousel'

interface Props {
  image: string
  title: string
  slides: Slide[]
}

interface Slide {
  image: string
  text: string
}

export default function ParallaxCarouselSection({
  image,
  title,
  slides,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '5%'])

  return (
    <section
      ref={ref}
      className="relative h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      <motion.div
        style={{ y, backgroundImage: `url(${image})` }}
        className="absolute inset-0 bg-cover bg-center"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 text-white px-6 max-w-5xl w-full">
        <h2 className="text-4xl md:text-6xl font-serif text-center mb-6">
          {title}
        </h2>

        <Carousel
          slides={slides}
          className="mt-10"
        />
      </div>
    </section>
  )
}
