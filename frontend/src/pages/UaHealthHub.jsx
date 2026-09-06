import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronLeft, Clock, Search, Sparkles } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { UaHeader, UaFooter, CTA_CLASS, getUaPath, getUaAuthPath } from './UaLanding.jsx'
import { UA_HUB_ARTICLES, UA_HUB_CLUSTERS } from '../data/uaHealthHubContent.js'

// ── Hub Home ─────────────────────────────────────────────────────────────────

export function UaHealthHubHome() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return UA_HUB_ARTICLES
    return UA_HUB_ARTICLES.filter(a =>
      [a.title, a.description, a.clusterLabel, ...(a.keyPoints || [])].join(' ').toLowerCase().includes(q)
    )
  }, [query])

  const goArticle = (slug) => navigate(getUaPath(`/health-hub/${slug}`))
  const goCluster = (slug) => navigate(getUaPath(`/health-hub/topics/${slug}`))

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title="Health Hub — Статті про здоров'я українською | Vitaloop Ukraine"
        description="Докладні пояснення аналізів крові, симптомів і біомаркерів українською мовою. Феритин, вітамін D, ТТГ, кортизол та 95+ показників здоров'я."
        canonicalUrl="https://ua.vitaloop.today/health-hub/"
        locale="uk_UA"
        schemas={[{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Vitaloop Ukraine Health Hub',
          url: 'https://ua.vitaloop.today/health-hub/',
          inLanguage: 'uk-UA',
          description: 'Статті про аналізи крові, симптоми та біомаркери українською мовою.',
        }]}
      />
      <UaHeader />

      {/* Hero */}
      <section className="border-b border-[#e5dfd6] bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Health Hub · Україна</p>
          <h1 className="mt-3 max-w-2xl text-[34px] font-black leading-tight tracking-tight text-[#0f172a] sm:text-[48px]">
            Аналізи та симптоми: зрозуміло і без жаргону
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#475569] sm:text-lg">
            {UA_HUB_ARTICLES.length} статей про біомаркери, симптоми і аналізи крові — щоб краще підготуватися до розмови з лікарем.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-lg">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Пошук: феритин, вітамін D, ТТГ..."
              className="w-full rounded-full border border-[#e5dfd6] bg-white py-3 pl-11 pr-5 text-sm shadow-sm outline-none transition focus:border-[#14b8a6] focus:ring-4 focus:ring-[#14b8a6]/10"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">

        {/* Clusters */}
        {!query && (
          <section className="mb-14">
            <h2 className="mb-6 text-xl font-black text-[#0f172a]">Теми</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {UA_HUB_CLUSTERS.map(cluster => (
                <button
                  key={cluster.slug}
                  onClick={() => goCluster(cluster.slug)}
                  className="group flex flex-col gap-3 rounded-[22px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/40 hover:shadow-md"
                >
                  <span className="text-2xl">{cluster.icon}</span>
                  <div>
                    <h3 className="text-base font-black text-[#0f172a] group-hover:text-[#0f766e]">{cluster.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#64748b]">{cluster.description}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#0f766e]">
                    {cluster.articleSlugs.length} статей <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Articles */}
        <section>
          <h2 className="mb-6 text-xl font-black text-[#0f172a]">
            {query ? `Результати пошуку (${filtered.length})` : 'Всі статті'}
          </h2>
          {filtered.length === 0 && (
            <div className="rounded-[22px] border border-[#e5dfd6] bg-white p-8 text-center text-[#64748b]">
              Нічого не знайдено за запитом «{query}»
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(article => (
              <button
                key={article.slug}
                onClick={() => goArticle(article.slug)}
                className="group flex flex-col gap-4 rounded-[22px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/40 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#f0fdfa] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#0f766e]">
                    {article.clusterLabel}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                    <Clock className="h-3 w-3" />{article.readMin} хв
                  </span>
                </div>
                <h3 className="text-sm font-black leading-snug text-[#0f172a] group-hover:text-[#0f766e]">
                  {article.title}
                </h3>
                <p className="text-xs leading-5 text-[#64748b]">{article.description}</p>
                <div className="mt-auto flex flex-wrap gap-1">
                  {(article.biomarkers || []).slice(0, 3).map(b => (
                    <span key={b} className="rounded-full bg-[#f8f5f0] px-2 py-0.5 text-[10px] font-bold text-[#475569]">{b}</span>
                  ))}
                  {(article.biomarkers || []).length > 3 && (
                    <span className="rounded-full bg-[#f8f5f0] px-2 py-0.5 text-[10px] font-bold text-[#9ca3af]">+{article.biomarkers.length - 3}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 rounded-[28px] bg-[linear-gradient(135deg,#0f172a,#0f766e)] p-8 text-center text-white sm:p-12">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-[#5eead4]" />
          <h2 className="text-2xl font-black sm:text-3xl">Перевірте свої показники з Vitaloop</h2>
          <p className="mt-3 text-sm leading-6 text-[#d9fffb] sm:text-base">
            Завантажте результати аналізів і отримайте персональний підсумок із поясненнями та наступними кроками.
          </p>
          <button onClick={() => navigate(getUaAuthPath({ signup: true }))} className={`${CTA_CLASS} mt-7`}>
            Почати безкоштовно
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>

      <UaFooter />
    </div>
  )
}

// ── Cluster (Topic) Page ──────────────────────────────────────────────────────

export function UaHealthHubCluster() {
  const { clusterSlug } = useParams()
  const navigate = useNavigate()
  const cluster = UA_HUB_CLUSTERS.find(c => c.slug === clusterSlug)
  const articles = UA_HUB_ARTICLES.filter(a => cluster?.articleSlugs.includes(a.slug))

  if (!cluster) {
    return (
      <div className="min-h-screen bg-[#f8f5f0]">
        <UaHeader />
        <div className="flex min-h-[60vh] items-center justify-center text-[#64748b]">Тему не знайдено</div>
        <UaFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title={`${cluster.title} — Health Hub | Vitaloop Ukraine`}
        description={cluster.description}
        canonicalUrl={`https://ua.vitaloop.today/health-hub/topics/${cluster.slug}/`}
        locale="uk_UA"
      />
      <UaHeader />

      <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 sm:py-14">
        <button
          onClick={() => navigate(getUaPath('/health-hub'))}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-[#0f766e]"
        >
          <ChevronLeft className="h-4 w-4" /> Health Hub
        </button>

        <div className="mb-8">
          <span className="text-3xl">{cluster.icon}</span>
          <h1 className="mt-3 text-[32px] font-black tracking-tight sm:text-[40px]">{cluster.title}</h1>
          <p className="mt-3 text-base leading-7 text-[#475569]">{cluster.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map(article => (
            <button
              key={article.slug}
              onClick={() => navigate(getUaPath(`/health-hub/${article.slug}`))}
              className="group flex flex-col gap-3 rounded-[22px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/40 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#9ca3af]" />
                <span className="text-xs text-[#9ca3af]">{article.readMin} хв</span>
              </div>
              <h2 className="text-sm font-black leading-snug text-[#0f172a] group-hover:text-[#0f766e]">{article.title}</h2>
              <p className="text-xs leading-5 text-[#64748b]">{article.description}</p>
            </button>
          ))}
        </div>
      </div>

      <UaFooter />
    </div>
  )
}

// ── Article Page ──────────────────────────────────────────────────────────────

export function UaHealthHubArticle() {
  const { articleSlug } = useParams()
  const navigate = useNavigate()
  const article = UA_HUB_ARTICLES.find(a => a.slug === articleSlug)
  const related = UA_HUB_ARTICLES.filter(a => article?.relatedSlugs?.includes(a.slug))

  if (!article) {
    return (
      <div className="min-h-screen bg-[#f8f5f0]">
        <UaHeader />
        <div className="flex min-h-[60vh] items-center justify-center text-[#64748b]">Статтю не знайдено</div>
        <UaFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title={`${article.title} | Vitaloop Ukraine Health Hub`}
        description={article.description}
        canonicalUrl={`https://ua.vitaloop.today/health-hub/${article.slug}/`}
        locale="uk_UA"
        schemas={[{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.description,
          inLanguage: 'uk-UA',
          url: `https://ua.vitaloop.today/health-hub/${article.slug}/`,
          publisher: { '@type': 'Organization', name: 'Vitaloop Ukraine', url: 'https://ua.vitaloop.today/' },
        }]}
      />
      <UaHeader />

      <article className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 sm:py-14">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[#64748b]">
          <button onClick={() => navigate(getUaPath('/health-hub'))} className="hover:text-[#0f766e]">Health Hub</button>
          <span>/</span>
          <button
            onClick={() => navigate(getUaPath(`/health-hub/topics/${UA_HUB_CLUSTERS.find(c => c.slug === article.cluster || c.articleSlugs.includes(article.slug))?.slug || article.cluster}`))}
            className="hover:text-[#0f766e]"
          >
            {article.clusterLabel}
          </button>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#f0fdfa] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#0f766e]">
              {article.clusterLabel}
            </span>
            <span className="flex items-center gap-1 text-xs text-[#9ca3af]">
              <Clock className="h-3.5 w-3.5" /> {article.readMin} хв читання
            </span>
          </div>
          <h1 className="mt-4 text-[28px] font-black leading-tight tracking-tight sm:text-[36px]">{article.title}</h1>
          <p className="mt-4 text-base leading-7 text-[#475569]">{article.description}</p>

          {/* Key points */}
          {article.keyPoints?.length > 0 && (
            <div className="mt-6 rounded-[18px] border border-[#e5dfd6] bg-white p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[#0f766e]">У цій статті</p>
              <ul className="space-y-2">
                {article.keyPoints.map(pt => (
                  <li key={pt} className="flex items-start gap-2.5 text-sm text-[#334155]">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14b8a6]" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose-ua space-y-8">
          {(article.content || []).map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="mb-4 text-xl font-black text-[#0f172a]">{section.heading}</h2>
              )}
              {section.callout && (
                <div className="my-4 rounded-[16px] border-l-4 border-[#0d9488] bg-[#f0fdfa] px-5 py-4 text-sm font-semibold leading-6 text-[#0f4c3a]">
                  {section.callout}
                </div>
              )}
              {(section.paragraphs || []).map((p, j) => (
                <p key={j} className="mt-3 text-[15px] leading-8 text-[#334155]">{p}</p>
              ))}
            </section>
          ))}
        </div>

        {/* Biomarkers */}
        {article.biomarkers?.length > 0 && (
          <div className="mt-10 rounded-[20px] border border-[#e5dfd6] bg-white p-6">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.1em] text-[#0f766e]">🔬 Аналізи, які обговорюються</p>
            <div className="flex flex-wrap gap-2">
              {article.biomarkers.map(b => (
                <span key={b} className="rounded-full bg-[#f0fdfa] px-3 py-1.5 text-sm font-bold text-[#0f172a] ring-1 ring-[#99f6e4]">{b}</span>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 rounded-[16px] bg-[#f8f5f0] px-5 py-4 text-xs leading-5 text-[#64748b] ring-1 ring-[#e5dfd6]">
          <strong className="text-[#0f172a]">Важливо:</strong> Ця стаття є освітнім матеріалом. Vitaloop не надає медичних консультацій і не ставить діагнозів. Будь-які рішення щодо здоров'я обговорюйте з кваліфікованим лікарем.
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-[24px] bg-[linear-gradient(135deg,#0f172a,#0f766e)] p-7 text-white">
          <h3 className="text-xl font-black">Перевірте свої показники</h3>
          <p className="mt-2 text-sm leading-6 text-[#d9fffb]">
            Завантажте аналізи — Vitaloop покаже, що означають ваші результати і що зробити далі.
          </p>
          <button onClick={() => navigate(getUaAuthPath({ signup: true }))} className={`${CTA_CLASS} mt-5`}>
            Почати безкоштовно <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-lg font-black text-[#0f172a]">Читайте також</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map(rel => (
                <button
                  key={rel.slug}
                  onClick={() => navigate(getUaPath(`/health-hub/${rel.slug}`))}
                  className="group flex flex-col gap-2 rounded-[18px] border border-[#e5dfd6] bg-white p-4 text-left transition hover:border-[#14b8a6]/40"
                >
                  <span className="text-xs font-bold text-[#0f766e]">{rel.clusterLabel}</span>
                  <h4 className="text-sm font-black text-[#0f172a] group-hover:text-[#0f766e]">{rel.title}</h4>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      <UaFooter />
    </div>
  )
}
