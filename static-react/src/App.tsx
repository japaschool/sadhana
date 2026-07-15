import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PhoneCarousel from './components/PhoneCarousel'
import PracticeCategories from './components/PracticeCategories'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

import shot2 from './assets/shot-2.jpg'
import shot4 from './assets/shot-4.jpg'
import shot5 from './assets/shot-5.jpg'
import shot6 from './assets/shot-6.jpg'

const slides = [
  { src: shot2, caption: 'Works offline — syncs when back online' },
  { src: shot4, caption: 'Visual graphs of your progress over time' },
  { src: shot5, caption: 'Multi-metric custom reports' },
  { src: shot6, caption: 'Table view of all your entries' },
]

export default function App() {
  return (
    <div data-theme="sadhana" className="font-sans">
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 z-50">
          <Navbar />
        </div>
        <Hero />
      </div>
      <PhoneCarousel
        id="preview"
        slides={slides}
        eyebrow="Inside the app"
        title="Your practice, beautifully tracked"
        description="Browse all 8 screens of Sadhana Pro and see how easy it is to track any spiritual practice."
        accent="#3A7D5C"
      />
      <PracticeCategories />
      <TrackBanner />
      <Footer />
    </div>
  )
}
