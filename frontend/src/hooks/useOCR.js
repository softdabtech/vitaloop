import { useState, useRef } from 'react'
import * as Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export function useOCR() {
  const [progress, setProgress] = useState(0)
  const [extractedText, setExtractedText] = useState('')
  const [ocrConfidence, setOcrConfidence] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  async function processFile(file) {
    setIsProcessing(true)
    setProgress(0)

    try {
      let text = ''
      let confidence = null

      if (file.type === 'application/pdf') {
        text = await extractFromPDF(file)
      } else {
        const result = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
            }
          },
        })
        text = result.data.text
        confidence = result.data.confidence
      }

      setExtractedText(text)
      setOcrConfidence(confidence)
      return { text, confidence }
    } finally {
      setIsProcessing(false)
    }
  }

  async function extractFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const chunks = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)

      // Try native text layer first
      const textContent = await page.getTextContent()
      const nativeText = textContent.items.map((item) => item.str).join(' ')

      if (nativeText.trim().length > 50) {
        chunks.push(nativeText)
      } else {
        // Fallback: render to canvas and OCR
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        const result = await Tesseract.recognize(canvas, 'eng')
        chunks.push(result.data.text)
      }

      setProgress(Math.round((i / pdf.numPages) * 100))
    }

    return chunks.join('\n')
  }

  return { processFile, progress, extractedText, ocrConfidence, isProcessing }
}
