// Help Center content data
export const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    articles: [
      'what-is-vitaloop',
      'how-to-upload-first-lab',
      'understanding-results',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Features',
    icon: '📊',
    articles: [
      'dashboard-overview',
      'upload-page',
      'results-page',
      'protocol-page',
      'weekly-check-ins',
      'progress-tracking',
      'insights-page',
      'health-profile',
    ],
  },
  {
    id: 'account',
    title: 'Account & Settings',
    icon: '⚙️',
    articles: [
      'creating-account',
      'account-settings',
      'privacy-data-security',
      'export-your-data',
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Subscriptions',
    icon: '💳',
    articles: [
      'plans-pricing',
      'upgrading-to-premium',
      'managing-subscription',
      'canceling-subscription',
      'billing-issues',
    ],
  },
  {
    id: 'practitioner',
    title: 'Practitioner Features',
    icon: '👩‍⚕️',
    articles: [
      'practitioner-crm-overview',
      'adding-clients',
      'managing-client-labs',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '🔧',
    articles: [
      'supported-lab-formats',
      'upload-troubleshooting',
      'login-issues',
      'browser-compatibility',
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: '❓',
    articles: [
      'faq-accuracy',
      'faq-medical-device',
      'faq-vs-chatgpt',
      'faq-vs-kantesti',
      'faq-data-security',
      'faq-cancel',
    ],
  },
]

export const HELP_ARTICLES = {
  'what-is-vitaloop': {
    id: 'what-is-vitaloop',
    section: 'getting-started',
    title: 'What is VITALOOP?',
    readTime: '3 min',
    related: ['how-to-upload-first-lab', 'plans-pricing', 'faq-vs-chatgpt'],
    content: [
      {
        type: 'intro',
        text: 'VITALOOP is a health intelligence platform that connects symptoms, biomarkers, Knowledge Base reasoning, safety context, protocol sections, trends, and retest timing into one structured workflow.',
      },
      {
        type: 'heading',
        text: 'Who is VITALOOP for?',
      },
      {
        type: 'list',
        items: [
          '**Health-conscious individuals** who want to understand their blood work, not just receive a number and a range.',
          '**Biohackers and optimizers** tracking biomarker trends over months or years.',
          '**Nutritionists and health coaches** managing multiple client lab results from one dashboard.',
          '**Anyone who has ever paid $400 for blood tests and had no idea what to do next.**',
        ],
      },
      {
        type: 'heading',
        text: 'Key features',
      },
      {
        type: 'feature-grid',
        items: [
          { icon: '📤', title: 'Upload or enter lab data', desc: 'Use PDF/image uploads, manual biomarker entry, and structured lab inputs supported by the product flow.' },
          { icon: '🧠', title: 'Shared Analysis Core V2', desc: 'Names, values, units, ranges, symptoms, safety context, and trends are processed through one structured path.' },
          { icon: '⚠️', title: 'Prioritized and safety-aware', desc: 'Important findings, safety notes, and clinician discussion points are surfaced clearly.' },
          { icon: '💊', title: 'Structured protocol sections', desc: 'Nutrition, supplements, lifestyle, training/recovery, adherence, and retest suggestions are organized for review.' },
          { icon: '📈', title: 'Longitudinal tracking', desc: 'Compare multiple tests and check-ins over time. See what is changing.' },
          { icon: '✅', title: 'Weekly check-ins', desc: 'Track symptoms and adherence so every cycle has better context.' },
        ],
      },
      {
        type: 'heading',
        text: 'What makes VITALOOP different?',
      },
      {
        type: 'paragraph',
        text: 'Most tools give you an interpretation — a PDF report with color-coded ranges. VITALOOP gives you an **execution loop**: upload → identify problems → execute protocol → weekly check-in → retest 12 weeks later → see measurable change. Each cycle is smarter than the last.',
      },
      {
        type: 'tip',
        text: 'VITALOOP is not a medical device and does not replace your doctor. It helps you arrive at your next appointment with better data and more specific questions.',
      },
    ],
  },

  'how-to-upload-first-lab': {
    id: 'how-to-upload-first-lab',
    section: 'getting-started',
    title: 'How to Upload Your First Lab Test',
    readTime: '4 min',
    related: ['understanding-results', 'supported-lab-formats', 'upload-troubleshooting'],
    content: [
      {
        type: 'intro',
        text: 'Getting your blood test results into VITALOOP takes just a few guided steps. Here\'s the full step-by-step.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Go to the Upload page',
            body: 'After signing in, click **"Upload Lab PDF"** from your dashboard or open the Upload page from the sidebar. You can also drag a file directly onto the dashboard.',
          },
          {
            title: 'Select your file',
            body: 'Drag and drop your lab PDF into the upload area, or click **"Choose File"** to browse. Supported formats: **PDF, JPG, PNG**.\n\nFor best results, use the PDF downloaded directly from your lab\'s patient portal (Quest MyQuest, LabCorp Patient, etc.).',
          },
          {
            title: 'Wait for analysis',
            body: 'VITALOOP\'s AI reads your file and analyzes every biomarker — values, units, and reference ranges. Processing time varies depending on file size and number of markers.',
          },
          {
            title: 'Review your results',
            body: 'Once complete, you\'ll land on the Results page showing:\n- All detected biomarkers with current values\n- Status for each: Deficient / Borderline / Optimal / Elevated\n- **Top Priority** card — the one marker to focus on first',
          },
          {
            title: 'Check your protocol',
            body: 'Navigate to the **Protocol** tab to see your personalized recommendations with exact dosages, timing, and a retest schedule.',
          },
        ],
      },
      {
        type: 'tip',
        text: 'For the most accurate analysis, upload a high-quality PDF directly from your lab portal — not a phone photo of a printout. If you only have a photo, make sure it\'s well-lit, flat, and all text is legible.',
      },
      {
        type: 'heading',
        text: 'Troubleshooting upload issues',
      },
      {
        type: 'paragraph',
        text: 'If analysis fails or returns no results, see **Upload Troubleshooting** for common causes and fixes.',
      },
    ],
  },

  'understanding-results': {
    id: 'understanding-results',
    section: 'getting-started',
    title: 'Understanding Your Results',
    readTime: '4 min',
    related: ['protocol-page', 'insights-page', 'weekly-check-ins'],
    content: [
      {
        type: 'intro',
        text: 'The Results page shows every biomarker analyzed from your lab report, with status, value, and context.',
      },
      {
        type: 'heading',
        text: 'Biomarker status colors',
      },
      {
        type: 'status-table',
        items: [
          { color: '#dc2626', label: 'Deficient', bg: '#fef2f2', desc: 'Significantly below the reference range. Needs attention.' },
          { color: '#f59e0b', label: 'Borderline', bg: '#fffbeb', desc: 'Close to the lower boundary. Worth monitoring.' },
          { color: '#1d9e75', label: 'Optimal', bg: '#f0fdf9', desc: 'Within the healthy reference range.' },
          { color: '#f97316', label: 'Elevated', bg: '#fff7ed', desc: 'Above the reference range. May need follow-up.' },
        ],
      },
      {
        type: 'heading',
        text: 'Top Priority card',
      },
      {
        type: 'paragraph',
        text: "The **Top Priority** card appears at the top of your Results page and highlights the single most critical issue in your current labs. It's determined by severity, clinical impact, and how much it deviates from the optimal range.",
      },
      {
        type: 'heading',
        text: 'Reference ranges',
      },
      {
        type: 'paragraph',
        text: 'Reference ranges are captured directly from your lab report — they vary by lab, age, sex, and methodology. VITALOOP uses the ranges from *your* report, not generic population averages, so values are always interpreted in the correct context.',
      },
      {
        type: 'heading',
        text: 'Trend indicators',
      },
      {
        type: 'paragraph',
        text: 'If you have uploaded multiple lab reports, each biomarker shows a trend arrow (↑ improving / ↓ declining / → stable) compared to your previous test. This is one of the most powerful features for long-term optimization.',
      },
      {
        type: 'tip',
        text: 'Click any biomarker row to expand details — you\'ll see historical values, the reference range bar, and why VITALOOP flagged it.',
      },
    ],
  },

  'dashboard-overview': {
    id: 'dashboard-overview',
    section: 'dashboard',
    title: 'Dashboard Overview',
    readTime: '3 min',
    related: ['upload-page', 'results-page', 'health-profile'],
    content: [
      {
        type: 'intro',
        text: 'The dashboard is your health intelligence hub — a summary of all your biomarker data, active protocols, and upcoming actions.',
      },
      {
        type: 'heading',
        text: 'Main stats cards',
      },
      {
        type: 'list',
        items: [
          '**Total Biomarkers** — how many markers were analyzed across all uploaded tests.',
          '**Deficient** — markers currently below the optimal range.',
          '**Optimal** — markers within the healthy range.',
          '**Last Upload** — date of your most recent lab report.',
        ],
      },
      {
        type: 'heading',
        text: 'Key actions',
      },
      {
        type: 'paragraph',
        text: 'From the dashboard you can immediately: **Upload a new lab** / **View your active protocol** / **Start your weekly check-in**.',
      },
      {
        type: 'heading',
        text: 'Health profile prompt',
      },
      {
        type: 'paragraph',
        text: "If you haven't completed your Health Profile (age, sex, weight, height), a prompt appears on the dashboard. Filling it in improves AI analysis accuracy — reference ranges differ by age and sex.",
      },
      {
        type: 'heading',
        text: 'Navigation',
      },
      {
        type: 'paragraph',
        text: 'Use the **sidebar** (desktop) or **bottom bar** (mobile) to navigate between Dashboard, Upload, Results, Protocol, Progress, Insights, Check-ins, Health Profile, and Settings.',
      },
    ],
  },

  'upload-page': {
    id: 'upload-page',
    section: 'dashboard',
    title: 'Upload Page',
    readTime: '3 min',
    related: ['how-to-upload-first-lab', 'supported-lab-formats', 'upload-troubleshooting'],
    content: [
      {
        type: 'intro',
        text: 'The Upload page is where you submit new lab reports for AI analysis.',
      },
      {
        type: 'heading',
        text: 'Supported formats',
      },
      {
        type: 'list',
        items: [
          '**PDF** — recommended. Direct download from lab portal.',
          '**JPG / PNG** — photos of printed reports. Must be clear and legible.',
        ],
      },
      {
        type: 'heading',
        text: 'Uploading multiple reports',
      },
      {
        type: 'paragraph',
        text: 'You can upload as many reports as you want (Premium). Each upload is stored separately and appears in your **Lab Results** history. VITALOOP tracks trends across all uploads automatically.',
      },
      {
        type: 'heading',
        text: 'What happens during analysis',
      },
      {
        type: 'steps',
        items: [
          { title: 'File received', body: 'Your file is encrypted and securely passed to the AI analysis engine.' },
          { title: 'Document reading & parsing', body: 'The AI reads the document, identifies biomarker rows, values, units, and reference ranges.' },
          { title: 'Normalization', body: 'Units are standardized (e.g., mg/dL → mmol/L where needed). Markers are mapped to a universal taxonomy.' },
          { title: 'Analysis', body: 'Each marker is scored against clinical norms. Priority ranking is calculated.' },
          { title: 'Results ready', body: 'You\'re redirected to the Results page. Processing time depends on report complexity.' },
        ],
      },
      {
        type: 'tip',
        text: 'Free plan allows 1 active lab upload. Upgrade to Premium for unlimited uploads and longitudinal tracking.',
      },
    ],
  },

  'results-page': {
    id: 'results-page',
    section: 'dashboard',
    title: 'Results Page',
    readTime: '4 min',
    related: ['understanding-results', 'protocol-page', 'progress-tracking'],
    content: [
      {
        type: 'intro',
        text: 'The Results page lists every biomarker analyzed from a specific lab report, with filtering, sorting, and drill-down details.',
      },
      {
        type: 'heading',
        text: 'Filtering and sorting',
      },
      {
        type: 'list',
        items: [
          'Filter by status: **All / Deficient / Borderline / Optimal / Elevated**',
          'Sort by: priority, alphabetical, or deviation from range',
          'Search by biomarker name',
        ],
      },
      {
        type: 'heading',
        text: 'Individual biomarker details',
      },
      {
        type: 'paragraph',
        text: 'Click any row to expand it. You\'ll see: the reference range bar with your value plotted, historical values from previous uploads (trend line), and a short AI explanation of what this marker means.',
      },
      {
        type: 'heading',
        text: 'Top Priority card',
      },
      {
        type: 'paragraph',
        text: 'The card at the top of the Results page shows the single most important finding. Tap it to jump directly to the related protocol recommendation.',
      },
    ],
  },

  'protocol-page': {
    id: 'protocol-page',
    section: 'dashboard',
    title: 'Protocol Page',
    readTime: '5 min',
    related: ['understanding-results', 'weekly-check-ins', 'progress-tracking'],
    content: [
      {
        type: 'intro',
        text: 'The Protocol page contains your personalized action plan — specific supplements, lifestyle changes, and a retest schedule — generated from your biomarker results.',
      },
      {
        type: 'heading',
        text: 'What a protocol includes',
      },
      {
        type: 'list',
        items: [
          '**Supplement recommendations** — name, exact dosage, form (e.g. Ferrous Bisglycinate vs. Ferrous Sulfate), timing (morning/with food/before bed), and duration.',
          '**Lifestyle changes** — sleep, diet, and exercise adjustments specific to your deficiencies.',
          '**Retest schedule** — when to upload your next labs to measure progress.',
          '**Priority levels** — High / Medium / Low for each recommendation.',
        ],
      },
      {
        type: 'heading',
        text: 'Why these recommendations?',
      },
      {
        type: 'paragraph',
        text: 'Each recommendation is generated by our AI analysis engine using your specific biomarker values, their relationships to each other, and clinical evidence. For example: low ferritin + low vitamin C → ferrous bisglycinate + ascorbic acid co-supplementation, because vitamin C increases iron absorption.',
      },
      {
        type: 'heading',
        text: 'Buying supplements',
      },
      {
        type: 'paragraph',
        text: 'Many protocol items include an **iHerb** link so you can find the exact form and dosage recommended. VITALOOP does not earn commissions — links are provided for convenience only.',
      },
      {
        type: 'tip',
        text: 'Always discuss supplement protocols with your healthcare provider before starting, especially if you take medications.',
      },
    ],
  },

  'weekly-check-ins': {
    id: 'weekly-check-ins',
    section: 'dashboard',
    title: 'Weekly Check-ins',
    readTime: '3 min',
    related: ['protocol-page', 'progress-tracking', 'insights-page'],
    content: [
      {
        type: 'intro',
        text: 'Weekly check-ins let you track how your protocol is working — and help the AI adapt recommendations based on your real-world response.',
      },
      {
        type: 'heading',
        text: 'What is a check-in?',
      },
      {
        type: 'paragraph',
        text: 'A 2-minute questionnaire you complete once a week. It asks about energy levels, sleep quality, specific symptoms related to your deficiencies, and protocol adherence (did you take your supplements?)',
      },
      {
        type: 'heading',
        text: 'Why check-ins matter',
      },
      {
        type: 'list',
        items: [
          'They create a feedback loop between protocol and results.',
          'If you report side effects (e.g. nausea from iron), the AI can suggest timing adjustments.',
          'Check-in data appears in your Progress timeline alongside biomarker values.',
          'They remind you to stay consistent — one of the biggest factors in actually improving.',
        ],
      },
      {
        type: 'heading',
        text: 'How often to check in',
      },
      {
        type: 'paragraph',
        text: 'Weekly is ideal. VITALOOP sends an email reminder every 7 days if you have an active protocol. You can adjust this in Settings → Notifications.',
      },
    ],
  },

  'progress-tracking': {
    id: 'progress-tracking',
    section: 'dashboard',
    title: 'Progress Tracking',
    readTime: '3 min',
    related: ['results-page', 'weekly-check-ins', 'insights-page'],
    content: [
      {
        type: 'intro',
        text: 'The Progress page shows how your biomarkers have changed over time across multiple lab uploads.',
      },
      {
        type: 'heading',
        text: 'Timeline graphs',
      },
      {
        type: 'paragraph',
        text: 'Each tracked biomarker has a line chart showing values across all your uploaded tests. The optimal range is shaded green so you can see at a glance when you crossed from deficient to optimal.',
      },
      {
        type: 'heading',
        text: 'Before / After comparison',
      },
      {
        type: 'paragraph',
        text: 'Select any two lab uploads to compare side-by-side. See exactly which markers improved, declined, or stayed flat between tests.',
      },
      {
        type: 'heading',
        text: 'Exporting data',
      },
      {
        type: 'paragraph',
        text: 'Export your full biomarker history as a CSV from Settings → Export Data. You can share this with your doctor or import it into other tools.',
      },
      {
        type: 'tip',
        text: 'Progress tracking with multiple uploads is a Premium feature. Free plan shows results from the most recent upload only.',
      },
    ],
  },

  'insights-page': {
    id: 'insights-page',
    section: 'dashboard',
    title: 'Insights Page',
    readTime: '3 min',
    related: ['results-page', 'protocol-page', 'understanding-results'],
    content: [
      {
        type: 'intro',
        text: 'Insights are AI-generated explanations of patterns and relationships in your biomarker data — not just individual values, but how they interact.',
      },
      {
        type: 'heading',
        text: 'Example insights',
      },
      {
        type: 'list',
        items: [
          '"Your low ferritin (14 ng/mL) likely explains the fatigue you\'re experiencing. Ferritin is the primary storage form of iron and affects oxygen transport."',
          '"Low vitamin D + elevated PTH is a common pattern suggesting calcium metabolism compensation. Vitamin D repletion typically normalizes PTH within 8–12 weeks."',
          '"Three consecutive tests show TSH trending toward borderline. Consider discussing thyroid function with your physician at your next visit."',
        ],
      },
      {
        type: 'heading',
        text: 'How insights are generated',
      },
      {
        type: 'paragraph',
        text: 'our AI analysis engine analyzes your complete biomarker profile — not just individual flags — and identifies clinically meaningful patterns using established relationships between markers. Insights are re-generated each time you upload a new lab report.',
      },
    ],
  },

  'health-profile': {
    id: 'health-profile',
    section: 'dashboard',
    title: 'Health Profile',
    readTime: '2 min',
    related: ['dashboard-overview', 'account-settings', 'privacy-data-security'],
    content: [
      {
        type: 'intro',
        text: 'Your Health Profile stores basic personal information that improves the accuracy of AI analysis.',
      },
      {
        type: 'heading',
        text: 'What to fill in',
      },
      {
        type: 'list',
        items: [
          '**Age** — reference ranges for many markers differ significantly by decade.',
          '**Biological sex** — testosterone, hemoglobin, ferritin norms differ between males and females.',
          '**Weight / height** — used for BMI-adjusted references.',
          '**Current medications** (optional) — some medications affect biomarker levels.',
        ],
      },
      {
        type: 'heading',
        text: 'Privacy',
      },
      {
        type: 'paragraph',
        text: 'Your Health Profile is private by default and is only used to improve AI analysis. It is never shared with third parties. See Privacy & Data Security for full details.',
      },
    ],
  },

  'creating-account': {
    id: 'creating-account',
    section: 'account',
    title: 'Creating an Account',
    readTime: '2 min',
    related: ['account-settings', 'login-issues', 'plans-pricing'],
    content: [
      {
        type: 'intro',
        text: 'Creating a VITALOOP account is free and takes under a minute.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Go to the Sign Up page', body: 'Click **"Sign Up Free"** on the landing page or visit vitaloop.today/login?signup=true.' },
          { title: 'Enter your email and password', body: 'Use any valid email address. Password must be at least 8 characters.' },
          { title: 'Confirm your email', body: 'Check your inbox for a confirmation link from noreply@vitaloop.today. Click the link to activate your account.' },
          { title: 'Sign in', body: 'Return to vitaloop.today/login and sign in with your email and password. You can also continue with Google.' },
        ],
      },
      {
        type: 'tip',
        text: "If you don't receive the confirmation email within 5 minutes, check your spam folder. The sender is noreply@vitaloop.today.",
      },
    ],
  },

  'account-settings': {
    id: 'account-settings',
    section: 'account',
    title: 'Account Settings',
    readTime: '2 min',
    related: ['creating-account', 'privacy-data-security', 'canceling-subscription'],
    content: [
      {
        type: 'intro',
        text: 'Manage your account from the Settings page — accessible via the sidebar or bottom navigation bar.',
      },
      {
        type: 'heading',
        text: 'What you can change',
      },
      {
        type: 'list',
        items: [
          '**Display name** — shown in your dashboard header.',
          '**Email address** — requires re-verification after change.',
          '**Password** — enter current password to set a new one.',
          '**Notification preferences** — email frequency, reminder days.',
          '**Linked accounts** — connect or disconnect Google sign-in.',
        ],
      },
      {
        type: 'heading',
        text: 'Deleting your account',
      },
      {
        type: 'paragraph',
        text: 'Account deletion is permanent and removes all your data, uploads, and analysis history. To delete, go to Settings → Account → Delete Account. You\'ll be asked to confirm by typing your email address.',
      },
    ],
  },

  'privacy-data-security': {
    id: 'privacy-data-security',
    section: 'account',
    title: 'Privacy & Data Security',
    readTime: '3 min',
    related: ['health-profile', 'export-your-data', 'faq-data-security'],
    content: [
      {
        type: 'intro',
        text: 'Your health data is sensitive. Here\'s exactly how VITALOOP protects it.',
      },
      {
        type: 'heading',
        text: 'What data we store',
      },
      {
        type: 'list',
        items: [
          'Uploaded lab files (encrypted at rest)',
          'Analyzed biomarker values and analysis results',
          'Health Profile information you provide',
          'Weekly check-in responses',
          'Account credentials (password hashed, never stored in plain text)',
        ],
      },
      {
        type: 'heading',
        text: 'How we protect it',
      },
      {
        type: 'list',
        items: [
          '**Encryption at rest** — all data stored in Supabase (SOC 2 Type II certified infrastructure)',
          '**Encryption in transit** — all connections use HTTPS/TLS',
          '**Row-Level Security** — database-level policy ensures you can only access your own records',
          '**No third-party sharing** — your health data is never sold or shared with advertisers',
        ],
      },
      {
        type: 'heading',
        text: 'Your rights',
      },
      {
        type: 'paragraph',
        text: 'You can export all your data at any time (Settings → Export Data) or delete your account and all associated data permanently. Read the full Privacy Policy at vitaloop.today/privacy-policy.',
      },
    ],
  },

  'export-your-data': {
    id: 'export-your-data',
    section: 'account',
    title: 'Export Your Data',
    readTime: '2 min',
    related: ['privacy-data-security', 'progress-tracking'],
    content: [
      {
        type: 'intro',
        text: 'You can export your complete biomarker history and protocols at any time.',
      },
      {
        type: 'heading',
        text: 'How to export',
      },
      {
        type: 'steps',
        items: [
          { title: 'Go to Settings', body: 'Open the Settings page from the sidebar.' },
          { title: 'Find the Export section', body: 'Scroll to **Export Data**.' },
          { title: 'Choose export type', body: '**Biomarker history (CSV)** — all values across all uploads. **Protocol summary (PDF)** — current recommendations.' },
          { title: 'Download', body: 'The file downloads immediately. CSV can be opened in Excel, Numbers, or Google Sheets.' },
        ],
      },
    ],
  },

  'plans-pricing': {
    id: 'plans-pricing',
    section: 'billing',
    title: 'Plans & Pricing',
    readTime: '3 min',
    related: ['upgrading-to-premium', 'canceling-subscription', 'what-is-vitaloop'],
    content: [
      {
        type: 'intro',
        text: 'VITALOOP offers three plans: Free, Premium, and Enterprise (for practitioners and teams).',
      },
      {
        type: 'plan-table',
        plans: [
          {
            name: 'Free',
            price: '$0/month',
            color: '#64748b',
            features: [
              '1 active lab upload',
              'Structured biomarker summary',
              'Priority findings identified',
              'Basic dashboard',
              'Standard analysis',
            ],
          },
          {
            name: 'Premium',
            price: '$4.99/month',
            color: '#1d9e75',
            badge: 'Most popular',
            features: [
              'Unlimited uploads & retests',
              'Exact dosage protocols',
              'Weekly AI check-ins',
              'Progress timeline tracking',
              'Protocol adaptation',
              'Priority support',
            ],
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            color: '#0f172a',
            features: [
              'Practitioner CRM (10+ clients)',
              'Client progress dashboards',
              'Assignment workflows',
              'API access & integrations',
              'Team management',
            ],
          },
        ],
      },
      {
        type: 'paragraph',
        text: 'All plans include the same AI analysis quality. Premium unlocks longitudinal tracking, full protocols, and weekly check-ins.',
      },
    ],
  },

  'upgrading-to-premium': {
    id: 'upgrading-to-premium',
    section: 'billing',
    title: 'Upgrading to Premium',
    readTime: '2 min',
    related: ['plans-pricing', 'managing-subscription', 'billing-issues'],
    content: [
      {
        type: 'intro',
        text: 'Upgrade to Premium to unlock unlimited uploads, full protocols, and longitudinal tracking.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Open the Subscription page', body: 'Go to Settings → Subscription, or click the **"Upgrade"** button that appears when you try to access a Premium feature.' },
          { title: 'Choose your plan', body: 'Select Premium ($4.99/month). Annual billing option available at $49.99/year.' },
          { title: 'Enter payment details', body: 'Payments are processed securely by Stripe. VITALOOP never sees or stores your card number.' },
          { title: 'Access unlocked immediately', body: 'Your Premium features are active as soon as payment is confirmed.' },
        ],
      },
      {
        type: 'tip',
        text: 'Billing starts immediately. You can cancel at any time from Settings → Subscription.',
      },
    ],
  },

  'managing-subscription': {
    id: 'managing-subscription',
    section: 'billing',
    title: 'Managing Your Subscription',
    readTime: '2 min',
    related: ['upgrading-to-premium', 'canceling-subscription', 'billing-issues'],
    content: [
      {
        type: 'intro',
        text: 'View and manage your subscription from Settings → Subscription.',
      },
      {
        type: 'list',
        items: [
          '**Current plan** — shows active plan, next billing date, and amount.',
          '**Update payment method** — click to open Stripe\'s secure card update form.',
          '**Billing history** — full list of past invoices with download links.',
          '**Cancel subscription** — see the cancellation article below.',
        ],
      },
    ],
  },

  'canceling-subscription': {
    id: 'canceling-subscription',
    section: 'billing',
    title: 'Canceling Your Subscription',
    readTime: '2 min',
    related: ['managing-subscription', 'plans-pricing', 'billing-issues'],
    content: [
      {
        type: 'intro',
        text: 'You can cancel your Premium subscription at any time. No penalties, no questions.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Go to Settings → Subscription', body: 'Find the active plan section.' },
          { title: 'Click "Cancel Subscription"', body: 'Confirm when prompted.' },
          { title: 'Access until end of period', body: 'Your Premium access continues until the end of the current billing period. You won\'t be charged again.' },
          { title: 'Data remains available', body: 'After cancellation, your account reverts to Free. Your lab history and protocols remain visible — you won\'t lose your data.' },
        ],
      },
      {
        type: 'heading',
        text: 'Refund policy',
      },
      {
        type: 'paragraph',
        text: 'We offer refunds within 7 days of the charge if you haven\'t used the service. Contact info@softdab.tech to request a refund.',
      },
    ],
  },

  'billing-issues': {
    id: 'billing-issues',
    section: 'billing',
    title: 'Billing Issues',
    readTime: '2 min',
    related: ['managing-subscription', 'canceling-subscription', 'upgrading-to-premium'],
    content: [
      {
        type: 'intro',
        text: 'Having trouble with a charge or payment? Here\'s what to do.',
      },
      {
        type: 'heading',
        text: 'Payment failed',
      },
      {
        type: 'paragraph',
        text: 'If your card is declined: 1) Check the card details in Settings → Subscription → Update payment method. 2) Contact your bank to confirm the charge isn\'t being blocked. 3) Try a different card.',
      },
      {
        type: 'heading',
        text: 'Unexpected charge',
      },
      {
        type: 'paragraph',
        text: 'All charges come from **Stripe** on behalf of VITALOOP. If you see a charge you don\'t recognize, check your billing history in Settings → Billing History. If it\'s still unclear, email info@softdab.tech with the charge date and amount.',
      },
      {
        type: 'heading',
        text: 'Contact support',
      },
      {
        type: 'paragraph',
        text: 'For any unresolved billing issue, email **info@softdab.tech**. Include your account email and the transaction date.',
      },
    ],
  },

  'practitioner-crm-overview': {
    id: 'practitioner-crm-overview',
    section: 'practitioner',
    title: 'Practitioner CRM Overview',
    readTime: '4 min',
    related: ['adding-clients', 'managing-client-labs', 'plans-pricing'],
    content: [
      {
        type: 'intro',
        text: 'The Practitioner CRM is a separate workspace for health coaches, nutritionists, and functional medicine practitioners managing multiple client lab results.',
      },
      {
        type: 'heading',
        text: 'Who is it for?',
      },
      {
        type: 'list',
        items: [
          'Functional medicine doctors reviewing patient bloodwork',
          'Nutritionists managing client supplement protocols',
          'Health coaches tracking client progress over time',
          'Any practitioner managing 10+ clients with regular lab testing',
        ],
      },
      {
        type: 'heading',
        text: 'Key features',
      },
      {
        type: 'list',
        items: [
          '**Multi-client dashboard** — see all clients, their latest lab status, and upcoming retests at a glance.',
          '**Client assignment** — assign protocols, set goals, add practitioner notes.',
          '**Program templates** — create reusable protocol templates for common conditions (iron deficiency, thyroid, vitamin D repletion).',
          '**Team collaboration** — multiple practitioners can work on the same client roster.',
        ],
      },
      {
        type: 'heading',
        text: 'How to access',
      },
      {
        type: 'paragraph',
        text: 'The CRM is accessible via a separate login URL or from the main navigation if your account has the Practitioner role. Contact info@softdab.tech to set up a practitioner account.',
      },
    ],
  },

  'adding-clients': {
    id: 'adding-clients',
    section: 'practitioner',
    title: 'Adding Clients',
    readTime: '2 min',
    related: ['practitioner-crm-overview', 'managing-client-labs'],
    content: [
      {
        type: 'intro',
        text: 'Add clients to your CRM roster by invitation. Each client gets their own private VITALOOP account.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Open CRM → Clients', body: 'Go to the Clients section in the CRM sidebar.' },
          { title: 'Click "Invite Client"', body: 'Enter the client\'s email address.' },
          { title: 'Client accepts', body: 'The client receives an invitation email. After they sign up (or log in), they appear in your client list.' },
          { title: 'Assign a program', body: 'Once added, you can assign protocol templates, view their results, and add notes.' },
        ],
      },
    ],
  },

  'managing-client-labs': {
    id: 'managing-client-labs',
    section: 'practitioner',
    title: 'Managing Client Labs',
    readTime: '3 min',
    related: ['adding-clients', 'practitioner-crm-overview'],
    content: [
      {
        type: 'intro',
        text: 'View, review, and annotate each client\'s lab results from their individual profile page.',
      },
      {
        type: 'list',
        items: [
          '**View results** — see all uploaded labs, biomarker values, and AI analysis for any client.',
          '**Review protocols** — view the AI-generated protocol and add or override recommendations.',
          '**Add notes** — private practitioner notes visible only to your team.',
          '**Adjust recommendations** — modify dosages or add custom recommendations.',
          '**Schedule follow-ups** — set a reminder for when the client\'s next upload is due.',
        ],
      },
      {
        type: 'tip',
        text: 'Client data is only visible to practitioners they\'ve been connected with. Clients can revoke access at any time from their account settings.',
      },
    ],
  },

  'supported-lab-formats': {
    id: 'supported-lab-formats',
    section: 'troubleshooting',
    title: 'Supported Lab Formats',
    readTime: '2 min',
    related: ['upload-troubleshooting', 'how-to-upload-first-lab'],
    content: [
      {
        type: 'intro',
        text: 'VITALOOP can analyze biomarkers from a wide range of lab report formats.',
      },
      {
        type: 'support-table',
        items: [
          { label: 'Quest Diagnostics (PDF)', supported: true },
          { label: 'LabCorp (PDF)', supported: true },
          { label: 'Generic PDF lab reports', supported: true },
          { label: 'Phone photo of printed report (JPG/PNG)', supported: true, note: 'Clear, legible, well-lit only' },
          { label: 'European lab formats', supported: true, note: 'English language only' },
          { label: 'Handwritten results', supported: false },
          { label: 'Non-English reports', supported: false, note: 'Coming soon' },
          { label: 'Spreadsheets / Excel files', supported: false },
        ],
      },
      {
        type: 'tip',
        text: 'For best results, always download the PDF directly from your lab\'s patient portal rather than scanning or photographing a physical printout.',
      },
    ],
  },

  'upload-troubleshooting': {
    id: 'upload-troubleshooting',
    section: 'troubleshooting',
    title: 'Upload Troubleshooting',
    readTime: '3 min',
    related: ['supported-lab-formats', 'how-to-upload-first-lab', 'browser-compatibility'],
    content: [
      {
        type: 'intro',
        text: 'If your upload fails or returns unexpected results, use these steps to diagnose the issue.',
      },
      {
        type: 'heading',
        text: '"Analysis failed" error',
      },
      {
        type: 'list',
        items: [
          'The file may be a scanned image with too low resolution. Try downloading the original PDF from your lab portal.',
          'The PDF may be password-protected. Open it in a PDF viewer and re-save without password protection.',
          'Very large files (>20MB) may time out. Compress the PDF first.',
        ],
      },
      {
        type: 'heading',
        text: '"No biomarkers found"',
      },
      {
        type: 'list',
        items: [
          'Confirm you uploaded a lab result file — not an invoice, appointment summary, or other medical document.',
          'The report may be in a non-English language (not yet supported).',
          'The report may use a non-standard format. Try contacting support with a sample.',
        ],
      },
      {
        type: 'heading',
        text: 'Upload stuck at 99% / not completing',
      },
      {
        type: 'list',
        items: [
          'Refresh the page and check the Lab Results list — the upload may have completed in the background.',
          'Check your internet connection.',
          'Try a different browser (Chrome or Safari recommended).',
        ],
      },
      {
        type: 'tip',
        text: 'Still stuck? Email a copy of your lab file to info@softdab.tech and the team will manually review it.',
      },
    ],
  },

  'login-issues': {
    id: 'login-issues',
    section: 'troubleshooting',
    title: 'Login Issues',
    readTime: '3 min',
    related: ['creating-account', 'account-settings', 'browser-compatibility'],
    content: [
      {
        type: 'intro',
        text: 'Can\'t log in? Here are the most common causes and how to fix them.',
      },
      {
        type: 'heading',
        text: 'Forgot password',
      },
      {
        type: 'paragraph',
        text: 'Click **"Forgot password?"** on the login page. Enter your email and you\'ll receive a password reset link within a few minutes. Check spam if it doesn\'t arrive.',
      },
      {
        type: 'heading',
        text: 'Email not confirmed',
      },
      {
        type: 'paragraph',
        text: 'If you just registered and see an "Email not confirmed" message, check your inbox for the confirmation email from noreply@vitaloop.today. Click the link to activate your account.',
      },
      {
        type: 'heading',
        text: "Can't receive confirmation email",
      },
      {
        type: 'list',
        items: [
          'Check your spam / junk folder.',
          'Add noreply@vitaloop.today to your safe senders list.',
          'Wait 5 minutes — there may be a short delay.',
          'If still not received, contact info@softdab.tech with your email address.',
        ],
      },
      {
        type: 'heading',
        text: 'Google sign-in not working',
      },
      {
        type: 'paragraph',
        text: 'Make sure you\'re using the same Google account you originally signed up with. If you signed up with email/password, use that instead — Google sign-in creates a separate account.',
      },
    ],
  },

  'browser-compatibility': {
    id: 'browser-compatibility',
    section: 'troubleshooting',
    title: 'Browser Compatibility',
    readTime: '2 min',
    related: ['upload-troubleshooting', 'login-issues'],
    content: [
      {
        type: 'intro',
        text: 'VITALOOP works in all modern browsers. If you\'re experiencing display issues, this guide will help.',
      },
      {
        type: 'heading',
        text: 'Recommended browsers',
      },
      {
        type: 'list',
        items: [
          '**Google Chrome** (recommended) — latest version',
          '**Safari** — iOS and macOS',
          '**Mozilla Firefox** — latest version',
          '**Microsoft Edge** — Chromium-based',
        ],
      },
      {
        type: 'heading',
        text: 'If the page looks broken or features don\'t work',
      },
      {
        type: 'steps',
        items: [
          { title: 'Clear cache and cookies', body: 'In Chrome: Settings → Privacy → Clear browsing data. Select "Cached images and files" and "Cookies". Reload the page.' },
          { title: 'Disable browser extensions', body: 'Ad blockers and privacy extensions can sometimes block API calls. Try opening in an Incognito/Private window.' },
          { title: 'Update your browser', body: 'Make sure you\'re on the latest version of your browser.' },
          { title: 'Try a different browser', body: 'If issues persist in one browser, try another to isolate the problem.' },
        ],
      },
    ],
  },

  'faq-accuracy': {
    id: 'faq-accuracy',
    section: 'faq',
    title: 'How accurate is VITALOOP\'s biomarker analysis?',
    readTime: '2 min',
    related: ['supported-lab-formats', 'upload-troubleshooting'],
    content: [
      {
        type: 'intro',
        text: 'VITALOOP uses our clinical AI analysis stack for lab report reading and biomarker analysis — one of the most capable AI models for structured document understanding.',
      },
      {
        type: 'paragraph',
        text: 'Analysis accuracy depends primarily on **file quality**. A clear, machine-generated PDF from a lab portal typically achieves >95% analysis accuracy. A low-resolution phone photo may miss some values.',
      },
      {
        type: 'tip',
        text: 'Always cross-check analyzed values against the original PDF, especially before making health decisions. If you spot an error, you can edit values manually in the Results page.',
      },
    ],
  },

  'faq-medical-device': {
    id: 'faq-medical-device',
    section: 'faq',
    title: 'Is VITALOOP a medical device?',
    readTime: '1 min',
    related: ['what-is-vitaloop', 'privacy-data-security'],
    content: [
      {
        type: 'intro',
        text: 'No. VITALOOP is a decision-support and educational tool — not a medical device and not a replacement for professional medical care.',
      },
      {
        type: 'paragraph',
        text: 'All content on VITALOOP is for informational purposes only. Supplement recommendations should be discussed with your healthcare provider before starting, especially if you take medications or have chronic conditions.',
      },
    ],
  },

  'faq-vs-chatgpt': {
    id: 'faq-vs-chatgpt',
    section: 'faq',
    title: 'How is VITALOOP different from asking ChatGPT about my labs?',
    readTime: '2 min',
    related: ['what-is-vitaloop', 'faq-vs-kantesti', 'protocol-page'],
    content: [
      {
        type: 'intro',
        text: 'ChatGPT is a general-purpose AI assistant. VITALOOP is a purpose-built health execution system. The difference is significant in practice.',
      },
      {
        type: 'list',
        items: [
          '**Structured protocol, not a chat reply.** VITALOOP gives you a formatted, prioritized action plan — not a wall of text to interpret.',
          '**Longitudinal tracking.** VITALOOP stores your results and shows trends over time. ChatGPT has no memory of your previous uploads.',
          '**Weekly check-ins.** VITALOOP asks follow-up questions and adapts. ChatGPT gives a one-time answer.',
          '**Purpose-built for structured health context.** VITALOOP normalizes biomarker names, units, ranges, symptoms, safety context, trends, and retest logic. Generic chat may ignore structure or invent unsupported certainty.',
          '**Not a replacement for care.** You can use ChatGPT for general health questions. Use VITALOOP for systematic, repeatable lab analysis and clinician discussion preparation.',
        ],
      },
    ],
  },

  'faq-vs-kantesti': {
    id: 'faq-vs-kantesti',
    section: 'faq',
    title: 'How is VITALOOP different from Kantesti?',
    readTime: '2 min',
    related: ['what-is-vitaloop', 'faq-vs-chatgpt'],
    content: [
      {
        type: 'intro',
        text: 'Kantesti and VITALOOP both analyze blood test results, but they serve different use cases.',
      },
      {
        type: 'list',
        items: [
          '**Kantesti** is an enterprise B2B tool built for NHS, hospitals, and clinical networks — not for individuals or small practitioners.',
          '**VITALOOP** is built for health-conscious individuals and independent practitioners who want to track their own or clients\' results over time.',
          'Some tools focus on interpretation only: upload → report → done.',
          'VITALOOP provides a reusable execution loop: symptoms → labs → shared analysis core → protocol → check-ins → trends → retest.',
        ],
      },
    ],
  },

  'faq-data-security': {
    id: 'faq-data-security',
    section: 'faq',
    title: 'Is my health data secure?',
    readTime: '2 min',
    related: ['privacy-data-security', 'export-your-data'],
    content: [
      {
        type: 'intro',
        text: 'Yes. VITALOOP takes data security seriously — your health data is encrypted and only you can access it.',
      },
      {
        type: 'list',
        items: [
          'All data stored on **Supabase** — SOC 2 Type II certified infrastructure.',
          '**Row-level security** — database queries are isolated per user. Even if someone had database access, they couldn\'t read your records.',
          '**HTTPS everywhere** — all data in transit is encrypted.',
          '**No advertising** — your health data is never used for advertising or sold to third parties.',
          'Read the full **Privacy Policy** at vitaloop.today/privacy-policy.',
        ],
      },
    ],
  },

  'faq-cancel': {
    id: 'faq-cancel',
    section: 'faq',
    title: 'Can I cancel anytime?',
    readTime: '1 min',
    related: ['canceling-subscription', 'managing-subscription'],
    content: [
      {
        type: 'intro',
        text: 'Yes. There are no long-term contracts or cancellation fees.',
      },
      {
        type: 'list',
        items: [
          'Cancel from **Settings → Subscription** at any time.',
          'Access continues until the end of the current billing period.',
          'Your data and uploaded labs remain on your account even after cancelling (on the Free plan).',
          'You can reactivate Premium at any time.',
        ],
      },
    ],
  },
}

export const ALL_ARTICLE_IDS = Object.keys(HELP_ARTICLES)

export function getArticle(id) {
  return HELP_ARTICLES[id] || null
}

export function searchArticles(query) {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  return Object.values(HELP_ARTICLES).filter(article => {
    const titleMatch = article.title.toLowerCase().includes(q)
    const contentText = article.content
      .map(block => {
        if (block.type === 'intro' || block.type === 'paragraph' || block.type === 'heading') return block.text || ''
        if (block.type === 'list') return (block.items || []).join(' ')
        if (block.type === 'steps') return (block.items || []).map(i => i.title + ' ' + i.body).join(' ')
        return ''
      })
      .join(' ')
      .toLowerCase()
    return titleMatch || contentText.includes(q)
  })
}
