import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HELP_SECTIONS, getArticle, searchArticles } from '../data/helpArticles.js'
import Navbar from '../components/landing/Navbar.jsx'
import Footer from '../components/landing/Footer.jsx'
import Seo from '../components/Seo.jsx'

// ─── Article content renderer ────────────────────────────────────────────────

function renderInline(text) {
  if (!text) return null
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function ArticleBlock({ block }) {
  switch (block.type) {
    case 'intro':
      return (
        <p className="text-lg text-slate-600 leading-relaxed mb-6 pb-6 border-b border-slate-100 font-medium">
          {renderInline(block.text)}
        </p>
      )
    case 'heading':
      return (
        <h2 className="text-xl font-bold text-slate-900 mt-8 mb-3">
          {block.text}
        </h2>
      )
    case 'paragraph':
      return (
        <p className="text-slate-600 leading-relaxed mb-4">
          {renderInline(block.text)}
        </p>
      )
    case 'list':
      return (
        <ul className="space-y-2 mb-5 ml-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-slate-600 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="space-y-4 mb-6">
          {block.items.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="font-semibold text-slate-900 mb-1">{step.title}</div>
                <div className="text-slate-600 leading-relaxed text-sm">
                  {step.body.split('\n').map((line, j) => (
                    <span key={j}>{renderInline(line)}{j < step.body.split('\n').length - 1 && <br/>}</span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )
    case 'tip':
      return (
        <div className="flex gap-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl p-4 mb-5">
          <span className="text-emerald-600 font-bold text-sm flex-shrink-0 mt-0.5">💡 Tip</span>
          <p className="text-slate-700 text-sm leading-relaxed">{renderInline(block.text)}</p>
        </div>
      )
    case 'status-table':
      return (
        <div className="space-y-2 mb-6">
          {block.items.map((row, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100" style={{ background: row.bg }}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: row.color }} />
              <span className="font-semibold text-sm w-24 flex-shrink-0" style={{ color: row.color }}>{row.label}</span>
              <span className="text-slate-600 text-sm">{row.desc}</span>
            </div>
          ))}
        </div>
      )
    case 'support-table':
      return (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
          {block.items.map((row, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
              <span className="text-slate-700">{row.label}</span>
              <div className="flex items-center gap-2">
                {row.note && <span className="text-slate-400 text-xs">{row.note}</span>}
                <span className={`font-bold text-base ${row.supported ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {row.supported ? '✓' : '✗'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )
    case 'feature-grid':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {block.items.map((item, i) => (
            <div key={i} className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <div className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</div>
                <div className="text-slate-500 text-sm leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )
    case 'plan-table':
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {block.plans.map((plan, i) => (
            <div key={i} className="border-2 rounded-2xl overflow-hidden" style={{ borderColor: plan.color + '40' }}>
              <div className="px-5 py-4 text-white" style={{ background: plan.color }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{plan.name}</span>
                  {plan.badge && (
                    <span className="bg-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: plan.color }}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="text-white/80 font-medium mt-0.5">{plan.price}</div>
              </div>
              <ul className="p-4 space-y-2">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

// ─── Article view ─────────────────────────────────────────────────────────────

function ArticleView({ articleId, onBack }) {
  const navigate = useNavigate()
  const article = getArticle(articleId)
  const section = article ? HELP_SECTIONS.find(s => s.id === article.section) : null

  if (!article) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Article not found</h2>
        <p className="text-slate-500 mb-6">This article doesn't exist or may have moved.</p>
        <button onClick={onBack} className="text-emerald-600 font-semibold hover:underline">
          ← Back to Help Center
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
        <button onClick={onBack} className="hover:text-emerald-600 transition-colors">Help Center</button>
        <span>›</span>
        <span className="text-slate-500">{section?.title}</span>
        <span>›</span>
        <span className="text-slate-700 font-medium break-words">{article.title}</span>
      </div>

      {/* Article header */}
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            {section?.icon} {section?.title}
          </span>
          <span className="text-xs text-slate-400">{article.readTime} read</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 leading-tight sm:text-3xl">{article.title}</h1>
      </div>

      {/* Article content */}
      <div className="mb-10">
        {article.content.map((block, i) => (
          <ArticleBlock key={i} block={block} />
        ))}
      </div>

      {/* Related articles */}
      {article.related?.length > 0 && (
        <div className="border-t border-slate-100 pt-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Related Articles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {article.related.map(relId => {
              const rel = getArticle(relId)
              if (!rel) return null
              const relSection = HELP_SECTIONS.find(s => s.id === rel.section)
              return (
                <button
                  key={relId}
                  onClick={() => navigate(`/help/${relId}`)}
                  className="text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
                  <div className="text-xs text-slate-400 mb-1">{relSection?.icon} {relSection?.title}</div>
                  <div className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                    {rel.title} →
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Home view (section grid) ─────────────────────────────────────────────────

function HelpHome({ onSelectArticle }) {
  const navigate = useNavigate()
  const popularArticles = [
    'how-to-upload-first-lab',
    'understanding-results',
    'plans-pricing',
    'upload-troubleshooting',
    'faq-vs-chatgpt',
    'privacy-data-security',
  ]

  return (
    <div>
      {/* Popular articles */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Popular articles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {popularArticles.map(id => {
            const article = getArticle(id)
            if (!article) return null
            const section = HELP_SECTIONS.find(s => s.id === article.section)
            return (
              <button
                key={id}
                onClick={() => navigate(`/help/${id}`)}
                className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="text-xs text-slate-400 mb-1">{section?.icon} {section?.title}</div>
                <div className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                  {article.title}
                </div>
                <div className="text-xs text-slate-400 mt-1">{article.readTime} read</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* All sections */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">Browse by topic</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {HELP_SECTIONS.map(section => (
          <div key={section.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <span className="text-2xl">{section.icon}</span>
              <span className="font-bold text-slate-900">{section.title}</span>
              <span className="ml-auto text-xs text-slate-400 font-medium">{section.articles.length} articles</span>
            </div>
            <ul className="p-3 space-y-0.5">
              {section.articles.slice(0, 4).map(articleId => {
                const article = getArticle(articleId)
                if (!article) return null
                return (
                  <li key={articleId}>
                    <button
                      onClick={() => navigate(`/help/${articleId}`)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      {article.title}
                    </button>
                  </li>
                )
              })}
              {section.articles.length > 4 && (
                <li>
                  <button
                    onClick={() => navigate(`/help/section/${section.id}`)}
                    className="w-full text-left px-3 py-2 text-xs text-emerald-600 font-semibold hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    +{section.articles.length - 4} more →
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section view ─────────────────────────────────────────────────────────────

function SectionView({ sectionId, onBack }) {
  const navigate = useNavigate()
  const section = HELP_SECTIONS.find(s => s.id === sectionId)

  if (!section) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Section not found</h2>
        <button onClick={onBack} className="text-emerald-600 font-semibold hover:underline">← Back</button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
        <button onClick={onBack} className="hover:text-emerald-600 transition-colors">Help Center</button>
        <span>›</span>
        <span className="text-slate-700 font-medium">{section.title}</span>
      </div>
      <div className="mb-7 flex items-center gap-3 sm:mb-8">
        <span className="text-3xl sm:text-4xl">{section.icon}</span>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{section.title}</h1>
      </div>
      <div className="space-y-2">
        {section.articles.map(articleId => {
          const article = getArticle(articleId)
          if (!article) return null
          return (
            <button
              key={articleId}
              onClick={() => navigate(`/help/${articleId}`)}
              className="w-full text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors mb-0.5">
                  {article.title}
                </div>
                <div className="text-xs text-slate-400">{article.readTime} read</div>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Search results ───────────────────────────────────────────────────────────

function SearchResults({ query, onClear }) {
  const navigate = useNavigate()
  const results = useMemo(() => searchArticles(query), [query])

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Search results</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
        </div>
        <button onClick={onClear} className="self-start text-sm text-emerald-600 font-semibold hover:underline sm:self-auto">
          Clear search
        </button>
      </div>
      {results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No results found</h3>
          <p className="text-slate-500 mb-6">Try different keywords or browse the sections below.</p>
          <button onClick={onClear} className="text-emerald-600 font-semibold hover:underline">
            Browse all articles →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(article => {
            const section = HELP_SECTIONS.find(s => s.id === article.section)
            return (
              <button
                key={article.id}
                onClick={() => { onClear(); navigate(`/help/${article.id}`) }}
                className="w-full text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs text-slate-400 mb-1">{section?.icon} {section?.title}</div>
                  <div className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {article.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{article.readTime} read</div>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ activeSection, activeArticle }) {
  const navigate = useNavigate()

  return (
    <nav className="space-y-1">
      <button
        onClick={() => navigate('/help')}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          !activeSection && !activeArticle ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
      >
        🏠 All topics
      </button>

      <div className="pt-2">
        {HELP_SECTIONS.map(section => {
          const isSectionActive = activeSection === section.id || section.articles.includes(activeArticle)
          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => navigate(`/help/section/${section.id}`)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isSectionActive ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {section.icon} {section.title}
              </button>
              {isSectionActive && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                  {section.articles.map(articleId => {
                    const article = getArticle(articleId)
                    if (!article) return null
                    return (
                      <button
                        key={articleId}
                        onClick={() => navigate(`/help/${articleId}`)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          activeArticle === articleId
                            ? 'text-emerald-700 font-semibold bg-emerald-50'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {article.title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Help() {
  const { articleId, sectionId } = useParams()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [articleId, sectionId])

  const handleBack = () => navigate('/help')

  const pageTitle = articleId
    ? getArticle(articleId)?.title
    : sectionId
    ? HELP_SECTIONS.find(s => s.id === sectionId)?.title
    : 'Help Center'

  const canonicalPath = articleId
    ? `/help/${articleId}`
    : sectionId
    ? `/help/section/${sectionId}`
    : '/help'

  return (
    <>
      <Seo
        title={pageTitle ? `${pageTitle} — VITALOOP Help` : 'Help Center — VITALOOP'}
        description="Everything you need to know about using VITALOOP — uploads, results, protocols, billing, and more."
        path={canonicalPath}
      />
      <div className="min-h-screen bg-slate-50">
        <Navbar />

        {/* Hero */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 md:py-14">
            <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                </svg>
                Help Center
              </div>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
                How can we help you?
              </h1>
              <p className="text-base text-slate-500 sm:text-lg">
                Find answers to common questions about VITALOOP.
              </p>
            </div>

            {/* Search bar */}
            <div className="relative mx-auto max-w-xl">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search articles… (e.g. upload, protocol, billing)"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 md:py-12">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">

            {/* Sidebar — desktop */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 p-4">
                <Sidebar
                  activeSection={sectionId}
                  activeArticle={articleId}
                />
              </div>
            </aside>

            {/* Mobile sidebar toggle */}
            <div className="lg:hidden mb-1 w-full">
              <button
                onClick={() => setMobileMenuOpen(v => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {mobileMenuOpen ? 'Hide topics' : 'Browse all topics'}
              </button>
              {mobileMenuOpen && (
                <div className="mt-2 max-h-[60svh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <Sidebar
                    activeSection={sectionId}
                    activeArticle={articleId}
                  />
                </div>
              )}
            </div>

            {/* Main content */}
            <main className="min-w-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-6 md:p-8">
                {searchQuery.length >= 2 ? (
                  <SearchResults query={searchQuery} onClear={() => setSearchQuery('')} />
                ) : articleId ? (
                  <ArticleView articleId={articleId} onBack={handleBack} />
                ) : sectionId ? (
                  <SectionView sectionId={sectionId} onBack={handleBack} />
                ) : (
                  <HelpHome onSelectArticle={id => navigate(`/help/${id}`)} />
                )}
              </div>

              {/* Contact block */}
              <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-center text-white sm:mt-6 sm:rounded-2xl sm:p-6">
                <h3 className="text-lg font-bold mb-1">Still need help?</h3>
                <p className="text-emerald-100 text-sm mb-4">
                  Our team usually replies within one business day.
                </p>
                <a
                  href="mailto:info@softdab.tech"
                  className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact support
                </a>
              </div>
            </main>

          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
