import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { HELP_SECTIONS, getArticle, searchArticles } from '../data/helpArticles.js'
import Navbar from '../components/landing/Navbar.jsx'
import Footer from '../components/landing/Footer.jsx'
import Seo from '../components/Seo.jsx'
import { BookOpen, ChevronRight, CircleHelp, FileText, Home, Lightbulb, Menu, Search, X } from 'lucide-react'
import { CoachAlert, CoachBadge, CoachButton, CoachCard, CoachInput, EmptyCoachState } from '../components/coach/CoachUI.jsx'
import '../styles/coach-design-system.css'
import '../styles/help-center.css'

const SECTION_ICONS = {
  getting_started: BookOpen,
  lab_results: FileText,
  default: CircleHelp,
}

function HelpSectionIcon({ sectionId, className = 'h-5 w-5' }) {
  const Icon = SECTION_ICONS[sectionId] || SECTION_ICONS.default
  return <Icon className={className} aria-hidden="true" />
}

// ─── Article content renderer ────────────────────────────────────────────────

function renderInline(text) {
  if (!text) return null
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[color:var(--vtl-color-ink)]">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function renderMultilineInline(text) {
  const lines = String(text || '').split('\n')
  return lines.map((line, index) => (
    <span key={index}>
      {renderInline(line)}
      {index < lines.length - 1 && <br />}
    </span>
  ))
}

function buildHelpPath(basePath, suffix = '') {
  const normalizedBase = String(basePath || '/help').replace(/\/$/, '')
  const normalizedSuffix = String(suffix || '').replace(/^\//, '')
  return normalizedSuffix ? `${normalizedBase}/${normalizedSuffix}` : normalizedBase
}

function resolveHelpPageMeta(articleId, sectionId, basePath = '/help') {
  if (articleId) {
    return {
      pageTitle: getArticle(articleId)?.title || 'Help Center',
      canonicalPath: buildHelpPath(basePath, articleId),
    }
  }

  if (sectionId) {
    return {
      pageTitle: HELP_SECTIONS.find((s) => s.id === sectionId)?.title || 'Help Center',
      canonicalPath: buildHelpPath(basePath, `section/${sectionId}`),
    }
  }

  return {
    pageTitle: 'Help Center',
    canonicalPath: buildHelpPath(basePath),
  }
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
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--vtl-color-brand-700)] flex-shrink-0" />
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
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--vtl-action-primary-bg)] text-[var(--vtl-action-primary-fg)] text-sm font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 pt-0.5">
              <div className="font-semibold text-slate-900 mb-1">{step.title}</div>
              <div className="text-slate-600 leading-relaxed text-sm">
                {renderMultilineInline(step.body)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    )
  case 'tip':
    return (
      <CoachAlert className="mb-5" icon={Lightbulb}>
        <p className="text-sm leading-relaxed"><strong>Tip.</strong> {renderInline(block.text)}</p>
      </CoachAlert>
    )
  case 'status-table':
    return (
      <div className="space-y-2 mb-6">
        {block.items.map((row, i) => (
          <CoachCard key={i} className="flex items-center gap-3 p-3">
            <CoachBadge tone="neutral">{row.label}</CoachBadge>
            <span className="text-sm text-[color:var(--vtl-color-ink-secondary)]">{row.desc}</span>
          </CoachCard>
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
          <CoachCard key={i} className="flex gap-3 p-4">
            <CircleHelp className="h-6 w-6 flex-shrink-0 text-[color:var(--vtl-color-brand-800)]" aria-hidden="true" />
            <div>
              <div className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</div>
              <div className="text-slate-500 text-sm leading-relaxed">{item.desc}</div>
            </div>
          </CoachCard>
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

function ArticleView({ articleId, onBack, helpBasePath }) {
  const navigate = useNavigate()
  const article = getArticle(articleId)
  const section = article ? HELP_SECTIONS.find(s => s.id === article.section) : null

  if (!article) {
    return (
      <EmptyCoachState icon={Search} title="Article not found" body="This article doesn't exist or may have moved." actionLabel="Back to Help Center" onAction={onBack} />
    )
  }

  return (
    <div className="help-center-article">
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
          <CoachBadge tone="primary"><HelpSectionIcon sectionId={section?.id} className="h-4 w-4" /> {section?.title}</CoachBadge>
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
                  onClick={() => navigate(buildHelpPath(helpBasePath, relId))}
                  className="text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><HelpSectionIcon sectionId={relSection?.id} className="h-3.5 w-3.5" /> {relSection?.title}</div>
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

function HelpHome({ onSelectArticle, helpBasePath }) {
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
    <div className="help-center-home">
      <CoachAlert tone="critical" className="mb-8 p-5 sm:p-6">
        <div>
        <h2 id="medical-safety-heading" className="text-lg font-bold">Medical safety and urgent concerns</h2>
        <p className="mt-2 text-sm leading-6">
          VITALOOP does not provide emergency care. If your symptoms may be urgent or severe, contact local emergency services or seek immediate medical care.
          Do not wait for VITALOOP analysis or a support response.
        </p>
        <p className="mt-2 text-sm leading-6">
          For non-urgent questions about your results, discuss the findings with a qualified clinician.
        </p>
        </div>
      </CoachAlert>

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
                onClick={() => navigate(buildHelpPath(helpBasePath, id))}
                className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><HelpSectionIcon sectionId={section?.id} className="h-3.5 w-3.5" /> {section?.title}</div>
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
          <CoachCard key={section.id} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <HelpSectionIcon sectionId={section.id} className="h-6 w-6 text-[color:var(--vtl-color-brand-800)]" />
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
                      onClick={() => navigate(buildHelpPath(helpBasePath, articleId))}
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
                    onClick={() => navigate(buildHelpPath(helpBasePath, `section/${section.id}`))}
                    className="w-full text-left px-3 py-2 text-xs text-emerald-600 font-semibold hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    +{section.articles.length - 4} more →
                  </button>
                </li>
              )}
            </ul>
          </CoachCard>
        ))}
      </div>

      <CoachCard className="mt-8 p-5 sm:p-6" aria-labelledby="support-paths-heading">
        <h2 id="support-paths-heading" className="text-lg font-bold text-slate-900">Support paths</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Email <a className="font-semibold text-emerald-700 underline underline-offset-2" href="mailto:info@softdab.tech">info@softdab.tech</a> for help with:
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li><strong>Upload problems:</strong> include the error and file type, but do not send sensitive lab files by email.</li>
          <li><strong>Report questions:</strong> include the report page and your question.</li>
          <li><strong>Account issues:</strong> include the account email and what action failed.</li>
          <li><strong>Billing issues:</strong> include the account email and transaction date.</li>
        </ul>
      </CoachCard>
    </div>
  )
}

// ─── Section view ─────────────────────────────────────────────────────────────

function SectionView({ sectionId, onBack, helpBasePath }) {
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
    <div className="help-center-section">
      <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-slate-400 sm:gap-2 sm:text-sm">
        <button onClick={onBack} className="hover:text-emerald-600 transition-colors">Help Center</button>
        <span>›</span>
        <span className="text-slate-700 font-medium">{section.title}</span>
      </div>
      <div className="mb-7 flex items-center gap-3 sm:mb-8">
        <HelpSectionIcon sectionId={section.id} className="h-9 w-9 text-[color:var(--vtl-color-brand-800)]" />
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{section.title}</h1>
      </div>
      <div className="space-y-2">
        {section.articles.map(articleId => {
          const article = getArticle(articleId)
          if (!article) return null
          return (
            <button
              key={articleId}
              onClick={() => navigate(buildHelpPath(helpBasePath, articleId))}
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

function SearchResults({ query, onClear, helpBasePath }) {
  const navigate = useNavigate()
  const results = useMemo(() => searchArticles(query), [query])

  return (
    <div className="help-center-search-results">
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
          <Search className="mx-auto mb-4 h-12 w-12 text-[color:var(--vtl-color-brand-800)]" aria-hidden="true" />
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
                onClick={() => { onClear(); navigate(buildHelpPath(helpBasePath, article.id)) }}
                className="w-full text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all group flex items-center justify-between"
              >
                <div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><HelpSectionIcon sectionId={section?.id} className="h-3.5 w-3.5" /> {section?.title}</div>
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

function Sidebar({ activeSection, activeArticle, helpBasePath }) {
  const navigate = useNavigate()

  return (
    <nav className="help-center-sidebar space-y-1">
      <button
        onClick={() => navigate(buildHelpPath(helpBasePath))}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          !activeSection && !activeArticle ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="inline-flex items-center gap-2"><Home className="h-4 w-4" aria-hidden="true" />All topics</span>
      </button>

      <div className="pt-2">
        {HELP_SECTIONS.map(section => {
          const isSectionActive = activeSection === section.id || section.articles.includes(activeArticle)
          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => navigate(buildHelpPath(helpBasePath, `section/${section.id}`))}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isSectionActive ? 'text-emerald-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-2"><HelpSectionIcon sectionId={section.id} className="h-4 w-4" />{section.title}</span>
              </button>
              {isSectionActive && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                  {section.articles.map(articleId => {
                    const article = getArticle(articleId)
                    if (!article) return null
                    return (
                      <button
                        key={articleId}
                        onClick={() => navigate(buildHelpPath(helpBasePath, articleId))}
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

export default function Help({ embedded = false, basePath = '/help' }) {
  const { articleId, sectionId } = useParams()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [articleId, sectionId])

  const helpBasePath = embedded ? '/help-center' : basePath
  const handleBack = () => navigate(helpBasePath)
  const { pageTitle, canonicalPath } = useMemo(
    () => resolveHelpPageMeta(articleId, sectionId, helpBasePath),
    [articleId, sectionId, helpBasePath]
  )

  return (
    <>
      <Seo
        title={pageTitle ? `${pageTitle} — VITALOOP Help` : 'Help Center — VITALOOP'}
        description="Everything you need to know about using VITALOOP — symptom intake, lab uploads, protocols, billing, and more."
        path={canonicalPath}
      />
      <div className={embedded ? 'help-center-scope min-h-full bg-transparent' : 'min-h-screen bg-slate-50'}>
        {!embedded && <Navbar />}

        {!embedded && (
          <div className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 md:py-14">
              <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                  Help Center
                </div>
                {articleId || sectionId ? (
                  <div className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
                    How can we help you?
                  </div>
                ) : (
                  <h1 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
                    How can we help you?
                  </h1>
                )}
                <p className="text-base text-slate-500 sm:text-lg">
                  Find answers to common questions about VITALOOP.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative mx-auto max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--vtl-color-ink-secondary)]" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search articles… (e.g. symptoms, labs, protocol, billing)"
                  className="coach-input min-h-11 py-3.5 pl-12 pr-12 text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--vtl-color-ink-secondary)]"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={embedded ? 'mx-0 px-0 py-0' : 'mx-auto max-w-6xl px-4 py-6 sm:py-8 md:py-12'}>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">

            {/* Sidebar — desktop */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className={`${embedded ? 'sticky top-0 bg-transparent border-0 p-0' : 'sticky top-24 bg-white rounded-2xl border border-slate-200 p-4'}`}>
                <Sidebar
                  helpBasePath={helpBasePath}
                  activeSection={sectionId}
                  activeArticle={articleId}
                />
              </div>
            </aside>

            {/* Mobile sidebar toggle */}
            <div className="lg:hidden mb-1 w-full">
              <CoachButton
                onClick={() => setMobileMenuOpen(v => !v)}
                variant="secondary"
                className="w-full"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
                {mobileMenuOpen ? 'Hide topics' : 'Browse all topics'}
              </CoachButton>
              {mobileMenuOpen && (
                <CoachCard className="mt-2 max-h-[60svh] overflow-y-auto p-4">
                  <Sidebar
                    helpBasePath={helpBasePath}
                    activeSection={sectionId}
                    activeArticle={articleId}
                  />
                </CoachCard>
              )}
            </div>

            {/* Main content */}
            <main className="min-w-0">
              <div className={`${embedded ? '' : 'rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-6 md:p-8'}`}>
                {searchQuery.length >= 2 ? (
                  <SearchResults query={searchQuery} onClear={() => setSearchQuery('')} helpBasePath={helpBasePath} />
                ) : articleId ? (
                  <ArticleView articleId={articleId} onBack={handleBack} helpBasePath={helpBasePath} />
                ) : sectionId ? (
                  <SectionView sectionId={sectionId} onBack={handleBack} helpBasePath={helpBasePath} />
                ) : (
                  <HelpHome helpBasePath={helpBasePath} onSelectArticle={id => navigate(buildHelpPath(helpBasePath, id))} />
                )}
              </div>

              {/* Contact block */}
              <div className={`${embedded ? 'mt-4 rounded-[var(--vtl-radius-card)]' : 'mt-4 rounded-xl sm:mt-6 sm:rounded-2xl'} bg-[var(--vtl-action-primary-bg)] p-5 text-center text-[color:var(--vtl-action-primary-fg)] sm:p-6`}>
                <h3 className="text-lg font-bold mb-1">Still need help?</h3>
                <p className="text-sm mb-4 opacity-85">
                  Email info@softdab.tech for upload, report, account, or billing questions. Our team usually replies within one business day.
                </p>
                <a
                  href="mailto:info@softdab.tech"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--vtl-radius-pill)] border border-[var(--vtl-action-secondary-border)] bg-[var(--vtl-action-secondary-bg)] px-5 py-2.5 text-sm font-bold text-[color:var(--vtl-action-secondary-fg)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact support
                </a>
              </div>

              {embedded && (
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="help-legal-heading">
                  <h3 id="help-legal-heading" className="text-sm font-bold uppercase tracking-wide text-slate-500">Legal and safety</h3>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link className="min-h-11 inline-flex items-center text-emerald-700 underline underline-offset-2" to="/privacy-policy">Privacy &amp; Security</Link>
                    <Link className="min-h-11 inline-flex items-center text-emerald-700 underline underline-offset-2" to="/terms">Terms</Link>
                    <Link className="min-h-11 inline-flex items-center text-emerald-700 underline underline-offset-2" to="/editorial-policy">Editorial Policy</Link>
                    <Link className="min-h-11 inline-flex items-center text-emerald-700 underline underline-offset-2" to="/medical-review-policy">Medical Review Policy</Link>
                    <Link className="min-h-11 inline-flex items-center text-emerald-700 underline underline-offset-2" to="/terms">Medical Disclaimer (in Terms)</Link>
                  </div>
                </section>
              )}
            </main>

          </div>
        </div>

        {!embedded && <Footer />}
      </div>
    </>
  )
}
