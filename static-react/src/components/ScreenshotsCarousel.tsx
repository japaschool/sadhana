import { useTranslation } from 'react-i18next'
import shot1 from '../assets/shot-1.jpg'
import shot2 from '../assets/shot-2.jpg'
import shot3 from '../assets/shot-3.jpg'
import shot4 from '../assets/shot-4.jpg'
import shot5 from '../assets/shot-5.jpg'
import shot6 from '../assets/shot-6.jpg'
import shot7 from '../assets/shot-7.jpg'
import shot8 from '../assets/shot-8.jpg'

const shots = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8]

const slideKeys = [
  'preview.slide1', 'preview.slide2', 'preview.slide3', 'preview.slide4',
  'preview.slide5', 'preview.slide6', 'preview.slide7', 'preview.slide8',
] as const

export default function ScreenshotsCarousel() {
  const { t } = useTranslation()

  const slides = shots.map((img, i) => ({
    image: img,
    caption: t(slideKeys[i]),
  }))

  return (
    <section className="bg-base-200 py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-4xl md:text-5xl font-bold text-center text-base-content mb-12"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {t('preview.title')}
        </h2>

        {/* Phone-width carousel centred on page */}
        <div className="max-w-xs mx-auto">
          <div className="carousel w-full rounded-3xl overflow-hidden shadow-2xl shadow-base-content/10 ring-1 ring-base-300">
            {slides.map((slide, i) => (
              <div
                key={i}
                id={`sp-slide-${i}`}
                className="carousel-item relative w-full"
              >
                <img
                  src={slide.image}
                  alt={slide.caption}
                  className="w-full h-[540px] object-cover select-none"
                  draggable={false}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-neutral/70 backdrop-blur-sm text-neutral-content text-center py-3 px-4 text-xs font-light">
                  {slide.caption}
                </div>
              </div>
            ))}
          </div>

          {/* Dot navigation */}
          <div className="flex justify-center gap-2 mt-5 flex-wrap">
            {slides.map((_, i) => (
              <a
                key={i}
                href={`#sp-slide-${i}`}
                className="w-2.5 h-2.5 rounded-full bg-base-300 hover:bg-primary transition-colors duration-200"
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
