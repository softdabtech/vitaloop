import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import { getGuideBySlug, GUIDES } from '../data/guidesContent.js'

export default function GuideArticle() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const guide = getGuideBySlug(slug)

  if (!guide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-slate-500">Guide not found.</p>
          <button onClick={() => navigate('/how-it-works')} className="mt-4 text-sm text-emerald-600 underline">
            Back to Health Intelligence Hub
          </button>
        </div>
      </div>
    )
  }

  const related = GUIDES.filter((g) => g.slug !== slug).slice(0, 2)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title={`${guide.title} | VITALOOP Health Intelligence Hub`}
        description={guide.description}
        path={`/guides/${guide.slug}`}
        schemas={[
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: guide.title,
            description: guide.description,
            author: { '@type': 'Organization', name: 'VITALOOP' },
            publisher: { '@type': 'Organization', name: 'VITALOOP', url: 'https://vitaloop.today' },
          },
        ]}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.07),transparent_34%)]" />
      </div>

      <PageHeader />

      {/* breadcrumb */}
      <div className="mx-auto max-w-[860px] px-4 pt-6 sm:px-6">
        <button
          onClick={() => navigate('/how-it-works')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Health Intelligence Hub
        </button>
      </div>

      {/* hero */}
      <header className="mx-auto max-w-[860px] px-4 pb-10 pt-6 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
              {guide.category}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {guide.readTime}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-slate-900 md:text-5xl">{guide.title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{guide.intro}</p>
        </motion.div>
      </header>

      {/* article body */}
      <main className="mx-auto max-w-[860px] px-4 pb-16 sm:px-6">
        <div className="space-y-12">
          {guide.sections.map((section, idx) => (
            <motion.section
              key={section.heading}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-8% 0px -8% 0px' }}
              transition={{ delay: idx * 0.04 }}
            >
              <h2 className="mb-4 text-2xl font-bold text-slate-900">{section.heading}</h2>
              <p className="mb-5 text-base leading-8 text-slate-600">{section.body}</p>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="space-y-3 rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          ))}
        </div>

        {/* takeaways */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-8% 0px -8% 0px' }}
          className="mt-14 rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 md:p-8"
        >
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Key takeaways</h2>
          </div>
          <ul className="space-y-3">
            {guide.takeaways.map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* disclaimer */}
        <p className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-6 text-slate-500">
          This guide is published for educational and informational purposes only. It does not constitute medical advice and is not a substitute for evaluation by a qualified healthcare professional. Always consult a physician before starting, stopping, or changing any supplementation or treatment protocol, particularly if you have a diagnosed medical condition.
        </p>

        {/* CTA */}
        <div className="mt-12 rounded-[32px] border border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-emerald-500" />
          <h2 className="text-2xl font-bold text-slate-900">Apply this to your own data</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
            Upload a lab report and VITALOOP will map these markers in your own panel, flag the patterns described here, and build a prioritized protocol.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate('/login?signup=true')}
              className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Analyse my blood test
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/example-report')}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50"
            >
              See example report
            </button>
          </div>
        </div>

        {/* related guides */}
        {related.length > 0 && (
          <div className="mt-14">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">More guides</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((g) => (
                <button
                  key={g.slug}
                  onClick={() => navigate(`/guides/${g.slug}`)}
                  className="group rounded-[24px] border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <span className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    {g.category}
                  </span>
                  <div className="text-base font-semibold text-slate-900 group-hover:text-emerald-700">{g.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{g.description}</div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    Read guide <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
