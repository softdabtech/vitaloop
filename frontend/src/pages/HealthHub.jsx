import { ArrowRight, BookOpen, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'
import { HEALTH_HUB_ARTICLES, HEALTH_HUB_CLUSTERS } from '../data/healthHubContent.js'
import { gaEvent } from '../lib/analytics.js'

export default function HealthHub() {
  const [query, setQuery] = useState('')
  const filteredArticles = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return HEALTH_HUB_ARTICLES
    return HEALTH_HUB_ARTICLES.filter((article) =>
      [article.title, article.description, article.cluster, ...article.keyPoints]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [query])

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Seo
        title="Health Intelligence Hub: Symptoms & Blood Tests | VITALOOP"
        description="Evidence-aware guides that connect symptoms, blood-test categories, biomarker context, clinician questions, and practical next steps."
        path="/health-hub"
        schemas={[{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'VITALOOP Health Intelligence Hub',
          '@id': 'https://vitaloop.today/health-hub/#collection',
          url: 'https://vitaloop.today/health-hub/',
          description: 'Evidence-aware guides about symptoms, blood tests, and biomarker context.',
          hasPart: [
            ...HEALTH_HUB_CLUSTERS.map((cluster) => ({
              '@type': 'CollectionPage',
              name: cluster.title,
              url: `https://vitaloop.today/health-hub/topics/${cluster.slug}/`,
            })),
            ...HEALTH_HUB_ARTICLES.map((article) => ({
              '@type': 'Article',
              name: article.title,
              url: `https://vitaloop.today/health-hub/${article.slug}/`,
            })),
          ],
        }]}
      />
      <PageHeader />

      <main>
        <section className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                <Sparkles className="h-4 w-4" /> Health Intelligence Hub
              </span>
              <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-[-0.045em] text-slate-950 sm:text-6xl">
                Understand the signal before you chase the number.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Practical, evidence-aware guides for connecting symptoms, blood tests, biomarker context, and better clinician conversations.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link onClick={() => gaEvent('health_hub_cta_click', { destination: 'symptom_intake' })} to="/symptom-intake/" className="inline-flex items-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800">
                  Start symptom check <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link to="/example-report/" className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-emerald-300">
                  See an example report
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">How to use the hub</p>
              <div className="mt-6 space-y-4">
                {[
                  ['1', 'Start with a symptom', 'Define timing, triggers, associated signs, and impact on daily life.'],
                  ['2', 'Review useful test categories', 'Understand what each test may clarify before discussing it with a clinician.'],
                  ['3', 'Read biomarkers in context', 'Connect related values, trends, symptoms, and known limitations.'],
                  ['4', 'Prepare better questions', 'Use the guide to make professional care more focused—not to self-diagnose.'],
                ].map(([number, title, body]) => (
                  <div key={number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 font-black text-slate-950">{number}</span>
                    <div>
                      <h2 className="font-bold">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Explore by concern</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Health topics built as connected clusters</h2>
            </div>
            <label className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm md:max-w-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <span className="sr-only">Search guides</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fatigue, ferritin, labs…" className="w-full bg-transparent text-sm outline-none" />
            </label>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {HEALTH_HUB_CLUSTERS.map((cluster) => {
              const Icon = cluster.icon
              return (
                <article key={cluster.id} className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br ${cluster.tone} p-7`}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm"><Icon className="h-6 w-6" /></span>
                    {cluster.comingSoon && <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-bold text-slate-500">Coming next</span>}
                  </div>
                  <h3 className="mt-6 text-2xl font-black"><Link to={`/health-hub/topics/${cluster.slug}/`} className="hover:text-emerald-800">{cluster.title}</Link></h3>
                  <p className="mt-3 max-w-xl leading-7 text-slate-600">{cluster.description}</p>
                  {!cluster.comingSoon && <Link to={`/health-hub/topics/${cluster.slug}/`} className="mt-6 inline-flex items-center text-sm font-bold text-emerald-800">{cluster.articleSlugs.length} connected guides <ArrowRight className="ml-2 h-4 w-4" /></Link>}
                </article>
              )
            })}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-emerald-700" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Evidence-aware library</p>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight">{query ? 'Search results' : 'Explore the connected guides'}</h2>

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((article) => {
                const Icon = article.icon
                return (
                  <Link onClick={() => gaEvent('health_hub_article_click', { article_slug: article.slug, cluster: article.cluster })} key={article.slug} to={`/health-hub/${article.slug}/`} className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
                      <span className="text-xs font-semibold text-slate-600">{article.readTime}</span>
                    </div>
                    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{article.cluster}</p>
                    <h3 className="mt-2 text-xl font-black tracking-tight group-hover:text-emerald-800">{article.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600">{article.description}</p>
                    <span className="mt-auto inline-flex items-center pt-6 text-sm font-bold text-emerald-700">Read guide <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
