import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PracticeCategories from './components/PracticeCategories'
import FeatureRows from './components/FeatureRows'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

export default function App() {
  return (
    <div data-theme="sadhana" className="font-sans">
      <Navbar />
      <Hero />
      <PracticeCategories />
      <FeatureRows />
      <TrackBanner />
      <Footer />
    </div>
  )
}
