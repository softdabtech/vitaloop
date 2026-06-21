import { Link } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'
import { HEALTH_HUB_ARTICLES, HEALTH_HUB_CLUSTERS } from '../data/healthHubContent.js'
import { ALL_ARTICLE_IDS, HELP_ARTICLES, HELP_SECTIONS } from '../data/helpArticles.js'

const PRODUCT_PAGES = [
  ['Home', '/'],
  ['How VITALOOP works', '/how-it-works/'],
  ['Features', '/features/'],
  ['Symptom intake', '/symptom-intake/'],
  ['Example report', '/example-report/'],
  ['For nutritionists', '/for-nutritionists/'],
  ['FAQ', '/faq/'],
  ['About VITALOOP', '/about/'],
]

const TRUST_PAGES = [
  ['Editorial policy', '/editorial-policy/'],
  ['Medical review policy', '/medical-review-policy/'],
  ['Editorial team', '/authors/vitaloop-editorial-team/'],
  ['Privacy policy', '/privacy-policy/'],
  ['Terms of service', '/terms/'],
]

function LinkGroup({ title, links }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-7">
      <h2 className="text-2xl font-black">{title}</h2>
      <ul className="mt-5 space-y-3">
        {links.map(([label, href]) => <li key={href}><Link className="font-semibold text-emerald-700 hover:underline" to={href}>{label}</Link></li>)}
      </ul>
    </section>
  )
}

export default function SiteMap() {
  const topicLinks = HEALTH_HUB_CLUSTERS.map((cluster) => [cluster.title, `/health-hub/topics/${cluster.slug}/`])
  const guideLinks = HEALTH_HUB_ARTICLES.map((article) => [article.title, `/health-hub/${article.slug}/`])
  const helpSectionLinks = HELP_SECTIONS.map((section) => [section.title, `/help/section/${section.id}/`])
  const helpLinks = ALL_ARTICLE_IDS.map((id) => [HELP_ARTICLES[id].title, `/help/${id}/`])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Seo title="VITALOOP Site Map | Health Guides and Product Pages" description="Browse every public VITALOOP product page, health guide, editorial standard, and help center resource from one accessible site map." path="/site-map" />
      <PageHeader />
      <main className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:py-20">
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">VITALOOP site map</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Browse all public product, health education, trust, and support resources.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <LinkGroup title="Product and company" links={PRODUCT_PAGES} />
          <LinkGroup title="Trust and policies" links={TRUST_PAGES} />
          <LinkGroup title="Health topics" links={topicLinks} />
          <LinkGroup title="Health guides" links={guideLinks} />
          <LinkGroup title="Help center topics" links={helpSectionLinks} />
          <LinkGroup title="Help articles" links={helpLinks} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
