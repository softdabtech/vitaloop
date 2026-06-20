import { ArrowLeft, ArrowRight, Check, Clock3, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'
import { getHealthHubArticle, HEALTH_HUB_ARTICLES } from '../data/healthHubContent.js'
import { gaEvent } from '../lib/analytics.js'

export default function HealthHubArticle() {
  const { articleSlug } = useParams()
  const article = getHealthHubArticle(articleSlug)
  if (!article) return <Navigate to="/404.html" replace />

  const Icon = article.icon
  const related = article.related.map(getHealthHubArticle).filter(Boolean)
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: '2026-06-20',
    dateModified: '2026-06-20',
    author: { '@type': 'Organization', name: 'VITALOOP Editorial Team', url: 'https://vitaloop.today/authors/vitaloop-editorial-team/' },
    publisher: { '@id': 'https://vitaloop.today/#organization' },
    mainEntityOfPage: `https://vitaloop.today/health-hub/${article.slug}/`,
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vitaloop.today/' },
      { '@type': 'ListItem', position: 2, name: 'Health Intelligence Hub', item: 'https://vitaloop.today/health-hub/' },
      { '@type': 'ListItem', position: 3, name: article.title, item: `https://vitaloop.today/health-hub/${article.slug}/` },
    ],
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Seo title={article.seoTitle} description={article.description} path={`/health-hub/${article.slug}`} schemas={[articleSchema, breadcrumbSchema]} />
      <PageHeader />

      <main>
        <article>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:py-20">
              <Link to="/health-hub/" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-emerald-700">
                <ArrowLeft className="mr-2 h-4 w-4" /> Health Intelligence Hub
              </Link>
              <div className="mt-10 flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon className="h-6 w-6" /></span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{article.eyebrow}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> {article.readTime} · Updated {article.updated}</p>
                </div>
              </div>
              <h1 className="mt-7 text-4xl font-black tracking-[-0.045em] sm:text-6xl">{article.title}</h1>
              <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-600">{article.summary}</p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm">
                <Link to="/authors/vitaloop-editorial-team/" className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700 hover:border-emerald-300">
                  <FileCheck2 className="mr-2 h-4 w-4 text-emerald-700" /> Editorially reviewed
                </Link>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900">
                  Not clinician-reviewed
                </span>
              </div>
            </div>
          </header>

          <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-16">
            <div>
              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
                <h2 className="text-xl font-black">Key points</h2>
                <ul className="mt-5 space-y-4">
                  {article.keyPoints.map((point) => (
                    <li key={point} className="flex gap-3 leading-7 text-slate-700"><Check className="mt-1 h-5 w-5 shrink-0 text-emerald-700" /> {point}</li>
                  ))}
                </ul>
              </section>

              <div className="mt-12 space-y-12">
                {article.sections.map((section) => (
                  <section key={section.heading}>
                    <h2 className="text-3xl font-black tracking-tight">{section.heading}</h2>
                    {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-5 text-[17px] leading-8 text-slate-700">{paragraph}</p>)}
                    {section.bullets && (
                      <ul className="mt-5 space-y-3">
                        {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-[17px] leading-8 text-slate-700"><span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />{bullet}</li>)}
                      </ul>
                    )}
                    {section.callout && (
                      <div className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                        <ShieldAlert className="mt-1 h-5 w-5 shrink-0" /><p className="leading-7">{section.callout}</p>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              <section className="mt-14 rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-2xl font-black">Sources and further reading</h2>
                <p className="mt-3 leading-7 text-slate-600">This guide is educational and does not diagnose or prescribe. The editorial team checked the claims against the sources below. It has not yet been reviewed by a licensed clinician.</p>
                <ul className="mt-6 space-y-3">
                  {article.sources.map((source) => (
                    <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer" className="inline-flex items-center font-bold text-emerald-700 hover:underline">{source.label}<ExternalLink className="ml-2 h-4 w-4" /></a></li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Turn reading into context</p>
                <h2 className="mt-3 text-xl font-black">Start with your symptoms</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Organize timing, duration, and related signals before deciding what to discuss next.</p>
                <Link onClick={() => gaEvent('health_article_cta_click', { article_slug: article.slug, destination: 'symptom_intake' })} to="/symptom-intake/" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Start free check <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white">
                <ShieldAlert className="h-5 w-5 text-emerald-300" />
                <h2 className="mt-3 font-black">Safety boundary</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">VITALOOP is a wellness education tool, not a medical device. Urgent or worsening symptoms need professional care.</p>
              </div>
            </aside>
          </div>
        </article>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Continue the fatigue cluster</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {related.map((item) => (
                <Link key={item.slug} to={`/health-hub/${item.slug}/`} className="rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:shadow-lg">
                  <h3 className="font-black">{item.title}</h3>
                  <span className="mt-4 inline-flex items-center text-sm font-bold text-emerald-700">Read next <ArrowRight className="ml-2 h-4 w-4" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
