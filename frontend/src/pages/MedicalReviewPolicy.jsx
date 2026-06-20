import { BadgeCheck, UserCheck } from 'lucide-react'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'

export default function MedicalReviewPolicy() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Seo
        title="Medical Review Policy | VITALOOP"
        description="Learn when VITALOOP health content requires licensed clinical review, how reviewer credentials are disclosed, and what a medical-review badge means."
        path="/medical-review-policy"
      />
      <PageHeader />
      <main className="mx-auto max-w-[900px] px-4 py-16 sm:px-6 lg:py-24">
        <BadgeCheck className="h-12 w-12 text-emerald-700" />
        <h1 className="mt-6 text-5xl font-black tracking-[-0.04em]">Medical review policy</h1>
        <p className="mt-6 text-xl leading-9 text-slate-600">A transparent standard for when clinical expertise is required and how we represent it.</p>

        <div className="mt-12 space-y-10 text-[17px] leading-8 text-slate-700">
          <section><h2 className="text-2xl font-black text-slate-950">What requires clinical review</h2><p className="mt-4">Content that gives condition-specific clinical guidance, interprets treatment decisions, discusses urgent triage in detail, or could materially change a reader’s medical behavior should be reviewed by an appropriately licensed professional before receiving a medical-review badge.</p></section>
          <section><h2 className="text-2xl font-black text-slate-950">Who can review</h2><p className="mt-4">The reviewer must have relevant, current credentials and review within their professional scope. The article will show the reviewer’s name, qualification, profile, review date, and role in the review.</p></section>
          <section><h2 className="text-2xl font-black text-slate-950">What the badge means</h2><p className="mt-4">A medical-review badge means the reviewer checked the article for reasonable clinical framing, material factual accuracy, safety boundaries, and appropriate source use. It does not turn educational content into personal medical advice.</p></section>
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-7"><h2 className="flex items-center gap-3 text-2xl font-black text-amber-950"><UserCheck className="h-6 w-6" /> Current status</h2><p className="mt-4 text-amber-950">VITALOOP does not currently claim clinician review for Health Hub articles. They remain clearly labeled as editorially reviewed and not clinician-reviewed until a qualified reviewer is formally engaged.</p></section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
