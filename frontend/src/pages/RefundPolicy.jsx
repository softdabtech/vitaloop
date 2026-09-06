import { Link } from 'react-router-dom'
import { RotateCcw, ShieldCheck, Stethoscope } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Seo
        title="Refund Policy | VITALOOP"
        description="Read the VITALOOP refund, cancellation, subscription access, and billing support policy."
        path="/refund-policy"
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
        <Link to="/" className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline">
          ← Back to VITALOOP
        </Link>

        <section className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <RotateCcw className="h-4 w-4" />
            Refund policy
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Refunds, cancellation, and billing support
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            VITALOOP Premium is a subscription for educational health intelligence: lab upload support, biomarker explanations, report structure, protocols, progress tracking, and check-ins. It does not provide diagnosis, treatment, prescriptions, or emergency medical services.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: August 24, 2026</p>
        </section>

        <section className="mt-10 grid gap-5">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Cancellation</h2>
            <p className="mt-3 leading-7 text-slate-600">
              You can cancel a Premium subscription at any time from your account billing area or by contacting <a className="font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>. After cancellation, Premium access usually remains available until the end of the paid billing period unless an immediate cancellation is requested and confirmed.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Refund review</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Refund requests are reviewed case by case. We generally consider refunds for duplicate charges, accidental purchases, technical checkout or access issues, or situations where Premium access was not delivered after payment. To request a review, contact support within 14 days of the charge and include the account email and transaction details.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Refund approval is not guaranteed after substantial use of Premium features, including repeated lab uploads, report generation, protocol generation, or export activity.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Payment processing</h2>
            <p className="mt-3 leading-7 text-slate-600">
              VITALOOP keeps billing and health intelligence data separate. We do not send uploaded lab files, symptoms, biomarker values, health reports, or protocol text to billing tools.
            </p>
          </article>

          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <Stethoscope className="h-6 w-6 text-amber-700" />
            <h2 className="mt-4 text-xl font-black text-slate-950">Medical disclaimer</h2>
            <p className="mt-3 leading-7 text-slate-700">
              VITALOOP is an educational wellness and health-data organization tool. Refund decisions are not based on medical outcomes. Always discuss concerning symptoms, abnormal lab values, supplements, and treatment decisions with a qualified clinician.
            </p>
          </article>

          <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-4 text-xl font-black text-slate-950">Need help?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              For cancellation, billing, or refund questions, email <a className="font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
              <Link className="text-emerald-700 underline" to="/pricing/">Pricing</Link>
              <Link className="text-emerald-700 underline" to="/terms/">Terms</Link>
              <Link className="text-emerald-700 underline" to="/privacy-policy/">Privacy policy</Link>
              <Link className="text-emerald-700 underline" to="/contact/">Contact</Link>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  )
}
