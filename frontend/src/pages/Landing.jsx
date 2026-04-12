import { lazy, Suspense } from 'react'
import Seo from '../components/Seo.jsx'
import '../styles/animations.css'
import { useScrollReveal } from '../hooks/useScrollReveal.js'

import Navbar           from '../components/landing/Navbar.jsx'
import Hero             from '../components/landing/Hero.jsx'
import SocialProofTicker from '../components/landing/SocialProofTicker.jsx'
import Footer from '../components/landing/Footer.jsx'

const HowItWorksSection = lazy(() => import('../components/landing/HowItWorks.jsx'))
const AvatarSection = lazy(() => import('../components/landing/AvatarSection.jsx'))
const ScienceSection = lazy(() => import('../components/landing/ScienceSection.jsx'))
const PartnersSection = lazy(() => import('../components/landing/PartnersSection.jsx'))
const Testimonials = lazy(() => import('../components/landing/Testimonials.jsx'))
const LongevitySection = lazy(() => import('../components/landing/LongevitySection.jsx'))
const PricingSection = lazy(() => import('../components/landing/PricingSection.jsx'))
const FAQ = lazy(() => import('../components/landing/FAQ.jsx'))
const FinalCTA = lazy(() => import('../components/landing/FinalCTA.jsx'))

export default function Landing() {
  useScrollReveal()

  return (
    <div style={{ background: 'var(--white)', color: 'var(--gray-900)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
      <Seo
        title="VITALOOP - AI Blood Test Analysis & Supplement Protocol"
        description="Upload any blood test PDF. AI identifies deficiencies, builds a personalized supplement protocol, and tracks your progress with a Digital Health Avatar. Free to start."
        path="/"
      />

      <Navbar />

      <main>
        <Hero />
        <SocialProofTicker />
        <Suspense fallback={<div style={{ height: '100vh' }} />}>
          <HowItWorksSection />
          <AvatarSection />
          <ScienceSection />
          <PartnersSection />
          <Testimonials />
          <LongevitySection />
          <PricingSection />
          <FAQ />
          <FinalCTA />
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}
