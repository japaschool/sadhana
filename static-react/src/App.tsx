import Navbar from './components/Navbar'
import Hero from './components/Hero'
import PhoneCarousel from './components/PhoneCarousel'
import FeaturesGrid from './components/FeaturesGrid'
import PracticeCategories from './components/PracticeCategories'
import TrackBanner from './components/TrackBanner'
import Footer from './components/Footer'

import shotHome from './assets/shot-home.jpg'
import shotOffline from './assets/shot-offline.jpg'
import shotAddPractice from './assets/shot-add-practice.jpg'
import shotCharts from './assets/shot-charts.jpg'
import shotGroup from './assets/shot-group.jpg'
import shotFaq from './assets/shot-faq.jpg'

const slides = [
  { src: shotHome, caption: 'Track your daily sadhana — japa, wake time, reading, and more' },
  { src: shotOffline, caption: "Works offline — syncs when you're back online" },
  { src: shotAddPractice, caption: 'Add any practice with custom data types' },
  { src: shotCharts, caption: 'Visual graphs across multiple metrics over time' },
  { src: shotGroup, caption: "Group tracking — see your sangha's progress together" },
  { src: shotFaq, caption: 'Built-in support with video guides and direct contact' },
]

export default function App() {
  return (
    <div data-theme="sadhana" className="font-sans">
      <div className="relative">
        <div className="absolute top-8 left-0 right-0 z-50">
          <Navbar />
        </div>
        <Hero />
      </div>
      <PhoneCarousel
        id="preview"
        slides={slides}
        title="Your practice, beautifully tracked"
        description="Browse all 8 screens of Sadhana Pro and see how easy it is to track any spiritual practice."
        accent="#3A7D5C"
      />
      <FeaturesGrid />
      <PracticeCategories />
      <TrackBanner />
      <Footer />
    </div>
  )
}
