const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const htmlPath = 'file://' + path.resolve('docs/INVESTOR_PITCH_DECK.html');
    console.log('Loading:', htmlPath);
    
    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const pdfPath = path.resolve('docs/VITALOOP_INVESTOR_PITCH_DECK.pdf');
    
    await page.pdf({
      path: pdfPath,
      width: '1280px',
      height: '720px',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
      printBackground: true,
      preferCSSPageSize: true
    });
    
    await browser.close();
    console.log('✅ PDF generated:', pdfPath);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
