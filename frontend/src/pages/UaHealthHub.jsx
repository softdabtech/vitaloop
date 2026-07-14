import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, Clock, ExternalLink, Search, Sparkles, UserRound } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { UaHeader, UaFooter, CTA_CLASS, getUaPath, getUaAuthPath } from './UaLanding.jsx'
import { getUaArticleEditorialMetadata, UA_HUB_ARTICLES, UA_HUB_CLUSTERS } from '../data/uaHealthHubContent.js'
import { pluralizeArticles, UA_COPY } from '../lib/uaCopy.js'

const formatDateUk = (value) => new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00Z`))

const sectionId = (heading, index) => `${String(heading || `section-${index + 1}`)
  .toLowerCase()
  .replace(/[^a-zа-яіїєґ0-9]+/giu, '-')
  .replace(/(^-|-$)/g, '')}-${index + 1}`

// ── Hub Home ─────────────────────────────────────────────────────────────────

export function UaHealthHubHome() {
  const [query, setQuery] = useState('')
  const featured = UA_HUB_ARTICLES[0]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return UA_HUB_ARTICLES
    return UA_HUB_ARTICLES.filter(a =>
      [a.title, a.description, a.clusterLabel, ...(a.keyPoints || [])].join(' ').toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title="Центр знань — статті про здоров'я українською | Vitaloop Ukraine"
        description="Докладні пояснення аналізів крові, симптомів і біомаркерів українською мовою. Феритин, вітамін D, ТТГ, кортизол та 95+ показників здоров'я."
        canonicalUrl="https://ua.vitaloop.today/health-hub/"
        locale="uk_UA"
        schemas={[{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Центр знань Vitaloop Ukraine',
          url: 'https://ua.vitaloop.today/health-hub/',
          inLanguage: 'uk-UA',
          description: 'Статті про аналізи крові, симптоми та біомаркери українською мовою.',
        }]}
      />
      <UaHeader />

      {/* Hero */}
      <section className="border-b border-[#e5dfd6] bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">{UA_COPY.knowledgeCenter} · Україна</p>
            <h1 className="mt-3 max-w-2xl text-[34px] font-black leading-tight tracking-tight text-[#0f172a] sm:text-[48px]">
            Аналізи та симптоми: зрозуміло і без жаргону
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#475569] sm:text-lg">
              {pluralizeArticles(UA_HUB_ARTICLES.length)} про біомаркери, симптоми й аналізи — щоб краще підготуватися до розмови з лікарем.
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
          {featured && (
            <Link to={getUaPath(`/health-hub/${featured.slug}`)} className="group rounded-[26px] border border-[#d7ebe6] bg-[#f0fdfa] p-6 transition hover:-translate-y-0.5 hover:border-[#14b8a6]/60 hover:shadow-md">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#0f766e]">Рекомендуємо почати</span>
              <h2 className="mt-3 text-xl font-black leading-snug text-[#0f172a] group-hover:text-[#0f766e]">{featured.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#475569]">{featured.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0f766e]">Читати статтю <ArrowRight className="h-4 w-4" /></span>
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">

        {/* Clusters */}
        {!query && (
          <section className="mb-14">
            <h2 className="mb-6 text-xl font-black text-[#0f172a]">Теми</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {UA_HUB_CLUSTERS.map(cluster => (
                <Link
                  key={cluster.slug}
                  to={getUaPath(`/health-hub/topics/${cluster.slug}`)}
                  className="group flex flex-col gap-3 rounded-[22px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/40 hover:shadow-md"
                >
                  <span className="text-2xl">{cluster.icon}</span>
                  <div>
                    <h3 className="text-base font-black text-[#0f172a] group-hover:text-[#0f766e]">{cluster.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#64748b]">{cluster.description}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#0f766e]">
                    {cluster.articleSlugs.length} {pluralizeArticles(cluster.articleSlugs.length)} <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
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
              <Link
                key={article.slug}
                to={getUaPath(`/health-hub/${article.slug}`)}
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
              </Link>
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
          <Link to={getUaAuthPath({ signup: true })} className={`${CTA_CLASS} mt-7`}>
            Почати безкоштовно
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      <UaFooter />
    </div>
  )
}

// ── Cluster (Topic) Page ──────────────────────────────────────────────────────

export function UaHealthHubCluster() {
  const { clusterSlug } = useParams()
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
        title={`${cluster.title} — Центр знань | Vitaloop Ukraine`}
        description={cluster.description}
        canonicalUrl={`https://ua.vitaloop.today/health-hub/topics/${cluster.slug}/`}
        locale="uk_UA"
      />
      <UaHeader />

      <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to={getUaPath('/health-hub')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-[#0f766e]"
        >
          <ChevronLeft className="h-4 w-4" /> {UA_COPY.knowledgeCenter}
        </Link>

        <div className="mb-8">
          <span className="text-3xl">{cluster.icon}</span>
          <h1 className="mt-3 text-[32px] font-black tracking-tight sm:text-[40px]">{cluster.title}</h1>
          <p className="mt-3 text-base leading-7 text-[#475569]">{cluster.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map(article => (
            <Link
              key={article.slug}
              to={getUaPath(`/health-hub/${article.slug}`)}
              className="group flex flex-col gap-3 rounded-[22px] border border-[#e5dfd6] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#14b8a6]/40 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#9ca3af]" />
                <span className="text-xs text-[#9ca3af]">{article.readMin} хв</span>
              </div>
              <h2 className="text-sm font-black leading-snug text-[#0f172a] group-hover:text-[#0f766e]">{article.title}</h2>
              <p className="text-xs leading-5 text-[#64748b]">{article.description}</p>
            </Link>
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
  const article = UA_HUB_ARTICLES.find(a => a.slug === articleSlug)
  const related = UA_HUB_ARTICLES.filter(a => article?.relatedSlugs?.includes(a.slug))
  const metadata = getUaArticleEditorialMetadata(article)
  const cluster = UA_HUB_CLUSTERS.find(c => c.slug === article?.cluster || c.articleSlugs.includes(article?.slug))
  const [readingProgress, setReadingProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const root = document.getElementById('ua-knowledge-article')
      if (!root) return
      const rect = root.getBoundingClientRect()
      const total = Math.max(1, root.offsetHeight - window.innerHeight)
      setReadingProgress(Math.min(100, Math.max(0, ((-rect.top + 80) / total) * 100)))
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [articleSlug])

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
        title={`${article.title} | Центр знань Vitaloop Ukraine`}
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
          author: { '@type': 'Organization', name: metadata.author, url: 'https://ua.vitaloop.today/about/' },
          publisher: { '@type': 'Organization', name: 'Vitaloop Ukraine', url: 'https://ua.vitaloop.today/' },
          datePublished: metadata.publishedAt,
          dateModified: metadata.updatedAt,
          citation: metadata.sources.map(source => source.url),
        }]}
      />
      <UaHeader />
      <div
        className="fixed inset-x-0 top-[60px] z-50 h-1 bg-transparent sm:top-[68px]"
        role="progressbar"
        aria-label="Прогрес читання"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(readingProgress)}
      >
        <div className="h-full bg-[#14b8a6] transition-[width] duration-150" style={{ width: `${readingProgress}%` }} />
      </div>

      <article id="ua-knowledge-article" className="mx-auto max-w-[820px] px-4 py-10 sm:px-6 sm:py-14">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[#64748b]">
          <Link to={getUaPath('/health-hub')} className="hover:text-[#0f766e]">{UA_COPY.knowledgeCenter}</Link>
          <span>/</span>
          <Link
            to={getUaPath(`/health-hub/topics/${cluster?.slug || article.cluster}`)}
            className="hover:text-[#0f766e]"
          >
            {article.clusterLabel}
          </Link>
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

          <div className="mt-6 grid gap-3 rounded-[18px] border border-[#e5dfd6] bg-white p-5 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]" />
              <div><p className="font-black text-[#0f172a]">{metadata.author}</p><p className="mt-1 text-xs text-[#64748b]">{metadata.reviewStatus}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]" />
              <div><p className="font-black text-[#0f172a]">Оновлено {formatDateUk(metadata.updatedAt)}</p><p className="mt-1 text-xs text-[#64748b]">Наступний перегляд: {formatDateUk(metadata.nextReviewAt)}</p></div>
            </div>
            <p className="text-xs font-bold text-[#475569] sm:col-span-2">Рівень доказовості: {metadata.evidenceLevel}. Стаття не має позначки клінічного рецензування.</p>
          </div>

          {(article.content || []).some(section => section.heading) && (
            <nav aria-label="Зміст статті" className="mt-6 rounded-[18px] border border-[#e5dfd6] bg-white p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[#0f766e]">У цій статті</p>
              <ul className="space-y-2">
                {(article.content || []).map((section, index) => section.heading && (
                  <li key={section.heading} className="flex items-start gap-2.5 text-sm text-[#334155]">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14b8a6]" />
                    <a href={`#${sectionId(section.heading, index)}`} className="hover:text-[#0f766e] hover:underline">{section.heading}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {article.keyPoints?.length > 0 && (
            <div className="mt-4 rounded-[18px] bg-[#f0fdfa] p-5 ring-1 ring-[#ccefe8]">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-[#0f766e]">Коротко</p>
              <ul className="space-y-2 text-sm leading-6 text-[#334155]">
                {article.keyPoints.map(point => <li key={point}>• {point}</li>)}
              </ul>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose-ua space-y-8">
          {(article.content || []).map((section, i) => (
            <section key={i} id={sectionId(section.heading, i)} className="scroll-mt-24">
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

        {metadata.sources.length > 0 && (
          <section className="mt-10 rounded-[20px] border border-[#e5dfd6] bg-white p-6" aria-labelledby="article-sources-title">
            <h2 id="article-sources-title" className="text-lg font-black text-[#0f172a]">Джерела</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">Офіційні матеріали, використані для редакційної перевірки цієї статті.</p>
            <ol className="mt-4 space-y-3">
              {metadata.sources.map(source => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-2 text-sm font-bold leading-6 text-[#0f766e] hover:underline">
                    <span>{source.publisher}: {source.title}</span><ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Disclaimer */}
        <div className="mt-8 rounded-[16px] bg-[#f8f5f0] px-5 py-4 text-xs leading-5 text-[#64748b] ring-1 ring-[#e5dfd6]">
          <strong className="text-[#0f172a]">Важливо:</strong> Ця стаття є освітнім матеріалом. Vitaloop не надає медичних консультацій і не ставить діагнозів. Будь-які рішення щодо здоров'я обговорюйте з кваліфікованим лікарем.
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-[24px] bg-[linear-gradient(135deg,#0f172a,#0f766e)] p-7 text-white">
          <h3 className="text-xl font-black">Перевірте свої показники</h3>
          <p className="mt-2 text-sm leading-6 text-[#d9fffb]">
            Завантажте аналізи — Vitaloop допоможе структурувати результати, пріоритети та питання до лікаря.
          </p>
          <Link to={getUaAuthPath({ signup: true })} className={`${CTA_CLASS} mt-5`}>
            Почати безкоштовно <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-lg font-black text-[#0f172a]">Читайте також</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.map(rel => (
                <Link
                  key={rel.slug}
                  to={getUaPath(`/health-hub/${rel.slug}`)}
                  className="group flex flex-col gap-2 rounded-[18px] border border-[#e5dfd6] bg-white p-4 text-left transition hover:border-[#14b8a6]/40"
                >
                  <span className="text-xs font-bold text-[#0f766e]">{rel.clusterLabel}</span>
                  <h4 className="text-sm font-black text-[#0f172a] group-hover:text-[#0f766e]">{rel.title}</h4>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      <UaFooter />
    </div>
  )
}
