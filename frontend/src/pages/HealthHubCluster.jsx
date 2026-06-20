import { ArrowLeft, ArrowRight, Check, ShieldAlert } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'
import { getHealthHubArticle, getHealthHubCluster } from '../data/healthHubContent.js'
import { gaEvent } from '../lib/analytics.js'

export default function HealthHubCluster() {
  const { clusterSlug } = useParams()
  const cluster = getHealthHubCluster(clusterSlug)
  if (!cluster) return <Navigate to="/404.html" replace />

  const Icon = cluster.icon
  const articles = cluster.articleSlugs.map(getHealthHubArticle).filter(Boolean)
  const url = `https://vitaloop.today/health-hub/topics/${cluster.slug}/`
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: cluster.title,
      description: cluster.seoDescription,
      url,
      isPartOf: { '@id': 'https://vitaloop.today/health-hub/#collection' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: articles.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `https://vitaloop.today/health-hub/${article.slug}/`,
          name: article.title,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vitaloop.today/' },
        { '@type': 'ListItem', position: 2, name: 'Health Intelligence Hub', item: 'https://vitaloop.today/health-hub/' },
        { '@type': 'ListItem', position: 3, name: cluster.title, item: url },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Seo title={cluster.seoTitle} description={cluster.seoDescription} path={`/health-hub/topics/${cluster.slug}`} schemas={schemas} />
      <PageHeader />
      <main>
        <header className={`border-b border-slate-200 bg-gradient-to-br ${cluster.tone}`}>
          <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:py-20">
            <Link to="/health-hub/" className="inline-flex items-center text-sm font-bold text-slate-600 hover:text-emerald-700">
              <ArrowLeft className="mr-2 h-4 w-4" /> Health Intelligence Hub
            </Link>
            <span className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm"><Icon className="h-7 w-7" /></span>
            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">{cluster.title}: a structured starting point</h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-700">{cluster.intro}</p>
          </div>
        </header>

        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:py-18">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] border border-slate-200 bg-white p-7">
              <h2 className="text-2xl font-black">Questions that narrow the problem</h2>
              <ul className="mt-6 space-y-4">
                {cluster.questions.map((question) => <li key={question} className="flex gap-3 leading-7 text-slate-700"><Check className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />{question}</li>)}
              </ul>
            </section>
            <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-7">
              <h2 className="text-2xl font-black">A safer interpretation workflow</h2>
              <ol className="mt-6 space-y-4">
                {cluster.steps.map((step, index) => <li key={step} className="flex gap-4 leading-7 text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">{index + 1}</span>{step}</li>)}
              </ol>
            </section>
          </div>

          <section className="mt-14">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Topic pathway</p>
            <h2 className="mt-2 text-3xl font-black">Read the connected guides</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link onClick={() => gaEvent('health_topic_article_click', { topic: cluster.slug, article_slug: article.slug })} key={article.slug} to={`/health-hub/${article.slug}/`} className="group flex flex-col rounded-[24px] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{article.eyebrow}</p>
                  <h3 className="mt-3 text-xl font-black group-hover:text-emerald-800">{article.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{article.description}</p>
                  <span className="mt-auto inline-flex items-center pt-6 text-sm font-bold text-emerald-700">Read guide <ArrowRight className="ml-2 h-4 w-4" /></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-14 flex gap-4 rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <ShieldAlert className="mt-1 h-6 w-6 shrink-0" />
            <div><h2 className="font-black">Educational boundary</h2><p className="mt-2 leading-7">These guides help organize symptoms, laboratory context, and questions. They do not diagnose a condition or replace examination and individualized medical care.</p></div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
