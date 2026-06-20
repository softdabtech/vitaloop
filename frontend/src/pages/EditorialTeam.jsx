import { BookOpenCheck, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'

export default function EditorialTeam() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Seo
        title="VITALOOP Editorial Team | Health Content Authors"
        description="Meet the team responsible for researching, writing, sourcing, updating, and correcting VITALOOP educational content about symptoms and blood tests."
        path="/authors/vitaloop-editorial-team"
      />
      <PageHeader />
      <main className="mx-auto max-w-[960px] px-4 py-16 sm:px-6 lg:py-24">
        <BookOpenCheck className="h-12 w-12 text-emerald-700" />
        <h1 className="mt-6 text-5xl font-black tracking-[-0.04em]">VITALOOP Editorial Team</h1>
        <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-600">The editorial team translates authoritative public-health and laboratory information into practical educational guides for symptom tracking, test discussions, and biomarker context.</p>

        <div className="mt-12 grid gap-6 md:grid-cols-[220px_1fr]">
          <img src="/images/alex.png" alt="Alex Bombela, founder of VITALOOP" className="h-52 w-52 rounded-[28px] border-4 border-white object-cover shadow-lg" />
          <section className="rounded-[28px] border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-black">Editorial ownership</h2>
            <p className="mt-4 leading-8 text-slate-700">Alex Bombela, Founder and CEO, is accountable for the product’s editorial standards and correction process. His background is in technology and product leadership—not clinical practice. VITALOOP does not represent him as a medical professional.</p>
            <a href="https://www.linkedin.com/in/aleksey-bombela/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center font-bold text-emerald-700 hover:underline">Professional profile <ExternalLink className="ml-2 h-4 w-4" /></a>
          </section>
        </div>

        <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-7">
          <h2 className="text-2xl font-black">How articles are produced</h2>
          <p className="mt-4 leading-8 text-slate-700">Writers use official health agencies, clinical guidelines, and peer-reviewed evidence. Claims are checked against cited sources, limitations are made visible, and medical-review status is disclosed on every article.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/editorial-policy/" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Editorial policy</Link>
            <Link to="/medical-review-policy/" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">Medical review policy</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
