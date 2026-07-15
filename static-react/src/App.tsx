import Hero from './components/Hero'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import ScreenshotsCarousel from './components/ScreenshotsCarousel'
import FeaturesGrid from './components/FeaturesGrid'
import TrackBanner from './components/TrackBanner'

export default function App() {
  return (
    <div data-theme="spiritual" className="relative font-sans">
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ScreenshotsCarousel />
      <TrackBanner />
      <Footer />
    </div>
  )
}