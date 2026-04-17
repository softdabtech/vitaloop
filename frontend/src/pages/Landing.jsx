import Seo from '../components/Seo.jsx'
import '../styles/animations.css'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

import Navbar            from '../components/landing/Navbar.jsx'
import Hero              from '../components/landing/Hero.jsx'
import ProblemSection    from '../components/landing/ProblemSection.jsx'
import HowItWorksSection      from '../components/landing/HowItWorks.jsx'
import ProtocolFeatureSection from '../components/landing/ProtocolFeatureSection.jsx'
import ValueBlock             from '../components/landing/ValueBlock.jsx'
import PricingSection    from '../components/landing/PricingSection.jsx'
import Testimonials      from '../components/landing/Testimonials.jsx'
import LongevitySection  from '../components/landing/LongevitySection.jsx'
import FinalCTA          from '../components/landing/FinalCTA.jsx'
import Footer            from '../components/landing/Footer.jsx'

export default function Landing() {
  useScrollReveal()

  return (
    <div style={{ background: 'var(--white)', color: 'var(--gray-900)' }}>
      <Seo
        title="VITALOOP - Longitudinal Lab Insights and Weekly Health Guidance"
        description="Upload labs, add symptoms, and receive personalized weekly health guidance. Track trends over time, monitor red flags, and escalate safely to a physician when needed."
        path="/"
      />

      <Navbar />

      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <ProtocolFeatureSection />
        <ValueBlock />
        <PricingSection />
        <Testimonials />
        <LongevitySection />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  )
}
