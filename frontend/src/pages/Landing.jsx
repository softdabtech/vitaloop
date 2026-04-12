import Seo from '../components/Seo.jsx'
import '../styles/animations.css'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

import Navbar           from '../components/landing/Navbar.jsx'
import Hero             from '../components/landing/Hero.jsx'
import SocialProofTicker from '../components/landing/SocialProofTicker.jsx'
import HowItWorksSection from '../components/landing/HowItWorks.jsx'
import AvatarSection    from '../components/landing/AvatarSection.jsx'
import ScienceSection   from '../components/landing/ScienceSection.jsx'
import PartnersSection  from '../components/landing/PartnersSection.jsx'
import Testimonials     from '../components/landing/Testimonials.jsx'
import PricingSection   from '../components/landing/PricingSection.jsx'
import FAQ              from '../components/landing/FAQ.jsx'
import FinalCTA         from '../components/landing/FinalCTA.jsx'
import Footer           from '../components/landing/Footer.jsx'

export default function Landing() {
  useScrollReveal()

  return (
    <div style={{ background: 'var(--white)', color: 'var(--gray-900)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
      <Seo
        title="AI Biomarker Analysis"
        description="Upload blood tests, explore an interactive biomarker map, and get AI-powered supplement protocols from VITALOOP."
        path="/"
      />

      <Navbar />

      <main>
        <Hero />
        <SocialProofTicker />
        <HowItWorksSection />
        <AvatarSection />
        <ScienceSection />
        <PartnersSection />
        <Testimonials />
        <PricingSection />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  )
}
