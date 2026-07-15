import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturesGrid from './components/FeaturesGrid'
import ScreenshotsCarousel from './components/ScreenshotsCarousel'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

export default function App() {
  return (
    <div data-theme="spiritual" className="font-sans">
      <Navbar />
      <Hero />
      <FeaturesGrid />
      <ScreenshotsCarousel />
      <TrackBanner />
      <Footer />
    </div>
  )
}
