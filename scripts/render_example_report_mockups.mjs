import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const outDir = path.resolve('frontend/public/mockups/example-report')

const pages = [
  {
    slug: 'dashboard',
    title: 'Today',
    eyebrow: 'Health command center',
    active: 'Dashboard',
    accent: 'emerald',
    content: `
      <div class="hero-card">
        <div>
          <p class="kicker">Current priority</p>
          <h2>Low iron storage pattern</h2>
          <p class="muted">Ferritin and fatigue signals are grouped for clinician discussion.</p>
        </div>
        <button>Review plan</button>
      </div>
      <div class="grid three">
        <div class="metric"><span>Health loop</span><strong>72%</strong><p>5 actions this week</p></div>
        <div class="metric"><span>Biomarkers</span><strong>38</strong><p>12 flagged for review</p></div>
        <div class="metric"><span>Next check-in</span><strong>Fri</strong><p>Symptoms and adherence</p></div>
      </div>
      <div class="panel">
        <h3>Next actions</h3>
        <div class="task done">Confirm iron follow-up with practitioner</div>
        <div class="task">Upload repeat CBC and ferritin panel</div>
        <div class="task">Complete weekly fatigue check-in</div>
      </div>
    `,
  },
  {
    slug: 'lab-results',
    title: 'Lab Results',
    eyebrow: 'Structured biomarker review',
    active: 'Lab Results',
    content: `
      <div class="panel">
        <div class="panel-head"><h3>Uploaded report</h3><button>Open source PDF</button></div>
        <table>
          <thead><tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Ferritin</td><td>12 ng/mL</td><td>30-150</td><td><span class="pill amber">Review</span></td></tr>
            <tr><td>Vitamin D</td><td>24 ng/mL</td><td>30-100</td><td><span class="pill amber">Low</span></td></tr>
            <tr><td>HbA1c</td><td>5.8%</td><td>4.8-5.6</td><td><span class="pill rose">Watch</span></td></tr>
            <tr><td>HDL</td><td>58 mg/dL</td><td>40-90</td><td><span class="pill green">In range</span></td></tr>
          </tbody>
        </table>
      </div>
    `,
  },
  {
    slug: 'upload',
    title: 'Upload Labs',
    eyebrow: 'PDF intake',
    active: 'Upload Labs',
    content: `
      <div class="upload-box">
        <div class="upload-icon">PDF</div>
        <h2>Drop your lab report here</h2>
        <p class="muted">PDF, clear scan, or full-page report. VITALOOP reads names, values, units, and ranges.</p>
        <button>Choose file</button>
      </div>
      <div class="grid two">
        <div class="metric"><span>Extraction</span><strong>AI + rules</strong><p>Source values preserved</p></div>
        <div class="metric"><span>Privacy</span><strong>Encrypted</strong><p>Access controlled by your account</p></div>
      </div>
    `,
  },
  {
    slug: 'progress',
    title: 'Progress',
    eyebrow: 'Trends over time',
    active: 'Progress',
    content: `
      <div class="panel">
        <h3>Biomarker trend</h3>
        <div class="chart">
          <div style="height:42%"></div><div style="height:58%"></div><div style="height:48%"></div><div style="height:70%"></div><div style="height:82%"></div>
        </div>
      </div>
      <div class="grid three">
        <div class="metric"><span>Energy</span><strong>+18%</strong><p>last 4 weeks</p></div>
        <div class="metric"><span>Sleep quality</span><strong>7.4</strong><p>weekly average</p></div>
        <div class="metric"><span>Adherence</span><strong>82%</strong><p>protocol completion</p></div>
      </div>
    `,
  },
  {
    slug: 'check-in',
    title: 'Weekly Check-in',
    eyebrow: 'Feedback loop',
    active: 'Weekly Check-in',
    content: `
      <div class="panel">
        <h3>How did this week feel?</h3>
        <div class="slider"><span>Fatigue</span><div><i style="width:38%"></i></div><b>4/10</b></div>
        <div class="slider"><span>Focus</span><div><i style="width:72%"></i></div><b>7/10</b></div>
        <div class="slider"><span>Sleep</span><div><i style="width:66%"></i></div><b>6/10</b></div>
      </div>
      <div class="note">VITALOOP connects symptom feedback to the next protocol cycle.</div>
    `,
  },
  {
    slug: 'crm',
    title: 'Practitioner Ops',
    eyebrow: 'Client review workspace',
    active: 'Assignments',
    content: `
      <div class="panel">
        <div class="panel-head"><h3>Client review queue</h3><button>Assign protocol</button></div>
        <div class="client"><strong>Anna M.</strong><span>Ferritin review</span><em>High priority</em></div>
        <div class="client"><strong>David K.</strong><span>Lipid panel follow-up</span><em>Review</em></div>
        <div class="client"><strong>Sofia R.</strong><span>Weekly check-in complete</span><em>Ready</em></div>
      </div>
      <div class="grid two">
        <div class="metric"><span>Open reviews</span><strong>14</strong><p>ranked by urgency</p></div>
        <div class="metric"><span>Client adherence</span><strong>76%</strong><p>last 30 days</p></div>
      </div>
    `,
  },
]

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6faf8; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; }
  .frame { width: 1600px; height: 1000px; display: grid; grid-template-columns: 320px 1fr; background: #f8fbfa; overflow: hidden; }
  aside { border-right: 1px solid #e2e8f0; background: #fff; padding: 34px 28px; display: flex; flex-direction: column; gap: 28px; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 950; font-size: 28px; letter-spacing: .01em; }
  .logo { width: 58px; height: 58px; border-radius: 18px; background: linear-gradient(135deg,#10d6ca,#08aeba); display: grid; place-items: center; color: white; font-weight: 950; font-size: 28px; }
  .brand span:first-of-type { color: #10343a; } .brand span:last-of-type { color: #08c7ba; }
  nav { display: grid; gap: 10px; margin-top: 16px; }
  nav div { padding: 15px 16px; border-radius: 16px; color: #64748b; font-size: 18px; font-weight: 750; }
  nav .active { background: #e9fbf5; color: #047857; box-shadow: inset 4px 0 0 #10b981; }
  .upgrade { margin-top: auto; border: 1px solid #fde68a; background: #fffbeb; border-radius: 22px; padding: 20px; color: #92400e; font-weight: 800; }
  main { padding: 48px 58px; }
  .top { display: flex; justify-content: space-between; align-items: start; margin-bottom: 34px; }
  .eyebrow { margin: 0 0 8px; color: #047857; text-transform: uppercase; letter-spacing: .16em; font-weight: 900; font-size: 14px; }
  h1 { margin: 0; font-size: 42px; letter-spacing: -.03em; }
  .date { border: 1px solid #dbe7e1; border-radius: 999px; padding: 12px 18px; color: #475569; background: #fff; font-weight: 750; }
  .hero-card, .panel, .metric, .upload-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 28px; box-shadow: 0 18px 45px rgba(15,23,42,.07); }
  .hero-card { padding: 34px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .hero-card h2, .upload-box h2 { margin: 0; font-size: 34px; letter-spacing: -.03em; }
  .muted { color: #64748b; font-size: 18px; line-height: 1.55; margin: 10px 0 0; }
  button { border: 0; background: #10b981; color: white; border-radius: 18px; padding: 16px 22px; font-weight: 900; font-size: 17px; }
  .grid { display: grid; gap: 20px; margin-bottom: 24px; } .three { grid-template-columns: repeat(3,1fr); } .two { grid-template-columns: repeat(2,1fr); }
  .metric { padding: 24px; } .metric span { color: #047857; text-transform: uppercase; letter-spacing: .14em; font-size: 13px; font-weight: 900; }
  .metric strong { display: block; margin-top: 10px; font-size: 34px; letter-spacing: -.03em; } .metric p { margin: 8px 0 0; color: #64748b; font-size: 16px; }
  .panel { padding: 30px; } .panel h3 { margin: 0 0 20px; font-size: 28px; letter-spacing: -.02em; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } .panel-head h3 { margin: 0; }
  .task { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 18px; margin-top: 12px; color: #475569; font-weight: 750; }
  .task.done { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
  table { width: 100%; border-collapse: collapse; font-size: 18px; } th { text-align: left; color: #64748b; padding: 14px 12px; } td { border-top: 1px solid #e2e8f0; padding: 18px 12px; font-weight: 750; }
  .pill { border-radius: 999px; padding: 8px 12px; font-size: 14px; font-weight: 900; } .amber { background:#fef3c7;color:#92400e; } .rose { background:#ffe4e6;color:#be123c; } .green { background:#dcfce7;color:#047857; }
  .upload-box { padding: 60px 40px; text-align: center; margin-bottom: 24px; border-style: dashed; border-width: 2px; }
  .upload-icon { margin: 0 auto 22px; width: 88px; height: 88px; border-radius: 28px; background: #e9fbf5; color: #047857; display: grid; place-items: center; font-weight: 950; font-size: 24px; }
  .chart { height: 300px; display: flex; align-items: end; gap: 28px; padding: 28px; background: linear-gradient(180deg,#f8fafc,#ecfdf5); border-radius: 22px; }
  .chart div { flex: 1; border-radius: 16px 16px 0 0; background: linear-gradient(180deg,#10b981,#0f766e); }
  .slider { display: grid; grid-template-columns: 140px 1fr 60px; align-items: center; gap: 18px; padding: 18px 0; border-top: 1px solid #e2e8f0; font-weight: 800; }
  .slider div { height: 14px; border-radius: 999px; background: #e2e8f0; overflow: hidden; } .slider i { display: block; height: 100%; background: #10b981; border-radius: 999px; }
  .note { margin-top: 24px; padding: 24px; border-radius: 24px; background: #ecfdf5; color: #047857; font-size: 22px; font-weight: 850; }
  .client { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 18px; align-items: center; border-top: 1px solid #e2e8f0; padding: 20px 0; font-size: 18px; }
  .client span { color: #64748b; } .client em { font-style: normal; border-radius: 999px; background: #ecfdf5; color: #047857; padding: 8px 12px; font-weight: 900; }
`

await fs.mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const pageDef of pages) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const navItems = ['Dashboard', 'Upload Labs', 'Lab Results', 'Assignments', 'Progress', 'Health Insights', 'Weekly Check-in', 'Health Profile']
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div class="frame">
      <aside>
        <div class="brand"><div class="logo">∞</div><div><span>VITA</span><span>LOOP</span></div></div>
        <nav>${navItems.map(item => `<div class="${item === pageDef.active ? 'active' : ''}">${item}</div>`).join('')}</nav>
        <div class="upgrade">Premium access<br><span style="color:#64748b;font-weight:700">Protocols, trends, and check-ins</span></div>
      </aside>
      <main>
        <div class="top">
          <div><p class="eyebrow">${pageDef.eyebrow}</p><h1>${pageDef.title}</h1></div>
          <div class="date">Example workspace</div>
        </div>
        ${pageDef.content}
      </main>
    </div>
  </body></html>`
  await page.setContent(html)
  await page.screenshot({ path: path.join(outDir, `${pageDef.slug}.png`) })
  await page.close()
}

await browser.close()
console.log(`Rendered ${pages.length} example-report mockups to ${outDir}`)
