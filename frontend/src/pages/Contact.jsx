import { Link } from 'react-router-dom'
import { Mail, ShieldCheck, Stethoscope } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Seo
        title="Contact VITALOOP | Support and Billing Help"
        description="Contact VITALOOP for account support, billing questions, privacy requests, partnerships, and product feedback."
        path="/contact"
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:py-20">
        <Link to="/" className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline">← Back to VITALOOP</Link>
        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <Mail className="h-4 w-4" />
            Contact
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">How to reach VITALOOP</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            We support users who want to better organize symptoms, lab results, progress tracking, and clinician discussion points. VITALOOP is educational software and is not a medical provider.
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Mail className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black">Product, account, and billing support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Questions about login, uploads, reports, subscriptions, cancellation, refund review, or product use.</p>
            <a className="mt-4 inline-flex font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black">Privacy and legal requests</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Requests about data access, deletion, privacy, terms, or legal notices use the same monitored SoftDAB inbox.</p>
            <a className="mt-4 inline-flex font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
            <Stethoscope className="h-6 w-6 text-amber-600" />
            <h2 className="mt-4 text-xl font-black">Medical safety note</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              VITALOOP does not provide emergency care, diagnosis, treatment, or prescription decisions. If you have urgent symptoms or concerning lab values, contact a licensed healthcare professional or emergency services in your area.
            </p>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  )
}
