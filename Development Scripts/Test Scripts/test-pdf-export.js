/**
 * Test script to verify PDF export generates visible content
 * Run with: node test-pdf-export.js
 */

const fs = require('fs')

// Simple HTML to test PDF generation
const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test PDF</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background: #1a1a1a;
      color: #f8f5f0;
      font-family: Arial, sans-serif;
      padding: 20mm;
    }
    
    h1 {
      font-size: 36px;
      color: #c8a562;
      margin-bottom: 20px;
    }
    
    .menu-item {
      background: #2a2a2a;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
    }
    
    .item-name {
      font-size: 18px;
      font-weight: bold;
      color: #f8f5f0;
    }
    
    .item-price {
      font-size: 16px;
      color: #c8a562;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>Test Menu</h1>
  <div class="menu-item">
    <div class="item-name">Test Item 1</div>
    <div class="item-price">$10.00</div>
  </div>
  <div class="menu-item">
    <div class="item-name">Test Item 2</div>
    <div class="item-price">$15.00</div>
  </div>
  <div class="menu-item">
    <div class="item-name">Test Item 3</div>
    <div class="item-price">$20.00</div>
  </div>
</body>
</html>`

async function testPDFGeneration() {
  try {
    const puppeteer = require('puppeteer')
    
    console.log('Launching browser...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    console.log('Creating page...')
    const page = await browser.newPage()
    
    console.log('Setting content...')
    await page.setContent(testHTML, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 60000
    })
    
    console.log('Waiting for fonts...')
    await page.evaluateHandle('document.fonts.ready')
    
    console.log('Generating PDF...')
    const pdfBytes = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })
    
    console.log('Saving PDF...')
    fs.writeFileSync('test-output.pdf', pdfBytes)
    
    console.log(`✓ PDF generated successfully (${pdfBytes.length} bytes)`)
    console.log('✓ Saved to test-output.pdf')
    
    await browser.close()
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

testPDFGeneration()
