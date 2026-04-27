const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

function buildPdfFromImages(pdfPath, imagePaths) {
  const pythonCode = [
    'import img2pdf',
    'import sys',
    '',
    'output = sys.argv[1]',
    'inputs = sys.argv[2:]',
    'if not inputs:',
    "    raise SystemExit('No slide images were provided')",
    'with open(output, "wb") as out_file:',
    '    out_file.write(img2pdf.convert(inputs))'
  ].join('\n');

  const pythonCmd = process.env.PYTHON || '/usr/local/bin/python3';
  const result = spawnSync(pythonCmd, ['-c', pythonCode, pdfPath, ...imagePaths], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Unknown Python PDF assembly error').trim());
  }
}

(async () => {
  let browser;
  let tempDir;

  try {
    const inputArg = process.argv[2] || 'docs/INVESTOR_PITCH_DECK.html';
    const outputArg = process.argv[3] || 'docs/VITALOOP_INVESTOR_PITCH_DECK.pdf';
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });

    const htmlPath = 'file://' + path.resolve(inputArg);
    console.log('Loading:', htmlPath);

    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('screen');
    await new Promise((resolve) => setTimeout(resolve, 300));

    const pdfPath = path.resolve(outputArg);
    const slideCount = await page.$$eval('.slide', (slides) => slides.length);

    if (!slideCount) {
      throw new Error('No .slide elements found in the document');
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitaloop-pitch-'));
    const slideImages = [];

    for (let index = 0; index < slideCount; index += 1) {
      const slideHandle = await page.$(`.slide:nth-of-type(${index + 1})`);

      if (!slideHandle) {
        throw new Error(`Slide ${index + 1} was not found`);
      }

      await slideHandle.evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
      });

      const box = await slideHandle.boundingBox();

      if (!box) {
        throw new Error(`Slide ${index + 1} has no render box`);
      }

      const imagePath = path.join(tempDir, `slide-${String(index + 1).padStart(2, '0')}.png`);

      await page.screenshot({
        path: imagePath,
        clip: {
          x: Math.max(0, Math.floor(box.x)),
          y: Math.max(0, Math.floor(box.y)),
          width: Math.ceil(box.width),
          height: Math.ceil(box.height)
        },
        captureBeyondViewport: true,
        type: 'png'
      });

      slideImages.push(imagePath);
    }

    buildPdfFromImages(pdfPath, slideImages);

    await browser.close();
    browser = null;

    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;

    console.log(`✅ PDF generated from ${slideCount} screen-rendered slides:`, pdfPath);
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
