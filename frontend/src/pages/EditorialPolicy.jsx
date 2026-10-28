import { CheckCircle2, FileCheck2, RefreshCw, ShieldAlert } from 'lucide-react'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'

const steps = [
  ['Define the user question', 'Each guide must answer a concrete symptom, testing, or biomarker interpretation question.'],
  ['Use authoritative sources', 'We prioritize government health agencies, professional guidelines, peer-reviewed reviews, and original research where appropriate.'],
  ['Write within product boundaries', 'Content explains context and questions to discuss; it does not diagnose, prescribe, or promise outcomes.'],
  ['Check claims and links', 'The editorial team verifies that claims are supported by the cited source and that limitations are visible.'],
  ['Publish review status', 'Every article states whether it is editorially reviewed, clinician-reviewed, or awaiting clinical review.'],
  ['Update or correct', 'Material changes are dated. Readers can report an error for correction and re-review.'],
]

export default function EditorialPolicy() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Seo
        title="Editorial Policy & Health Content Standards | VITALOOP"
        description="Read how VITALOOP researches, writes, reviews, updates, sources, and corrects educational content about symptoms, blood tests, and biomarkers."
        path="/editorial-policy"
      />
      <PageHeader />
      <main>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[980px] px-4 py-16 sm:px-6 lg:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700"><FileCheck2 className="h-4 w-4" /> Trust & transparency</span>
            <h1 className="mt-6 text-5xl font-black tracking-[-0.045em] sm:text-6xl">Editorial policy and health content standards</h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-600">How VITALOOP turns complex health information into useful educational guidance without overstating certainty or pretending to replace professional care.</p>
            <p className="mt-5 text-sm font-semibold text-slate-500">Effective June 20, 2026 · Owner: VITALOOP Editorial Team</p>
          </div>
        </header>

        <section className="mx-auto max-w-[980px] px-4 py-14 sm:px-6">
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-[24px] border border-slate-200 bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 font-black text-emerald-800">{index + 1}</span>
                <h2 className="mt-5 text-xl font-black">{title}</h2>
                <p className="mt-3 leading-7 text-slate-600">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 space-y-8">
            <section className="rounded-[28px] border border-slate-200 bg-white p-7 sm:p-9">
              <h2 className="flex items-center gap-3 text-2xl font-black"><ShieldAlert className="h-6 w-6 text-amber-600" /> Medical review status</h2>
              <p className="mt-4 leading-8 text-slate-700">We do not display a medical-review badge unless a licensed clinician has reviewed the specific article. Current Health Hub articles are editorially reviewed against authoritative sources and explicitly marked “Not clinician-reviewed.” Clinical review will be added article by article with the reviewer’s real name, credentials, scope, and review date.</p>
            </section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-7 sm:p-9">
              <h2 className="flex items-center gap-3 text-2xl font-black"><RefreshCw className="h-6 w-6 text-emerald-700" /> Corrections and updates</h2>
              <p className="mt-4 leading-8 text-slate-700">Substantive corrections are made directly in the article and the modified date is updated. To report an issue, email <a className="font-bold text-emerald-700 hover:underline" href="mailto:editorial@vitaloop.today">editorial@vitaloop.today</a> with the URL, claim, and supporting source.</p>
            </section>
            <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-7 sm:p-9">
              <h2 className="flex items-center gap-3 text-2xl font-black"><CheckCircle2 className="h-6 w-6 text-emerald-700" /> Core rule</h2>
              <p className="mt-4 text-lg leading-8 text-slate-800">If evidence is uncertain, mixed, population-specific, or not sufficient to support a conclusion, the content must say so.</p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
