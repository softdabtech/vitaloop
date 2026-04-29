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

  // Preprocess image for better OCR results
  function preprocessImage(canvas, ctx, image) {
    // Resize for better OCR
    const maxWidth = 2000
    const maxHeight = 2000
    let { width, height } = image

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width *= ratio
      height *= ratio
    }

    canvas.width = width
    canvas.height = height
    ctx.drawImage(image, 0, 0, width, height)

    // Apply image preprocessing for better OCR
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    // Increase contrast and brightness
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale with increased contrast
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128))
      data[i] = contrasted     // Red
      data[i + 1] = contrasted // Green
      data[i + 2] = contrasted // Blue
      // Alpha remains unchanged
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas
  }

  async function processFile(file) {
    setIsProcessing(true)
    setProgress(0)
    console.log('Starting file processing:', file.name, file.type, file.size)

    try {
      let text = ''
      let confidence = null

      if (file.type === 'application/pdf') {
        console.log('Processing as PDF')
        text = await extractFromPDF(file)
      } else {
        console.log('Processing as image')
        // Enhanced image processing with multiple OCR attempts
        text = await processImageWithOCR(file)
      }

      console.log('Extracted text length:', text.length)

      // Validate extracted text
      if (!text || text.trim().length < 10) {
        console.warn('Extracted text too short:', text.length)
        throw new Error('Not enough readable text found. Please ensure the document contains clear, legible text and try again.')
      }

      setExtractedText(text)
      setOcrConfidence(confidence)
      console.log('File processing completed successfully')
      return { text, confidence }
    } catch (error) {
      console.error('File processing error:', error)
      // Re-throw with user-friendly message
      throw error
    } finally {
      setIsProcessing(false)
    }
  }

  async function processImageWithOCR(file) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          // Preprocess image
          const processedCanvas = preprocessImage(canvas, ctx, img)

          // Try OCR with multiple configurations
          let bestResult = { text: '', confidence: 0 }

          // Configuration 1: English + Russian + Ukrainian
          try {
            const result1 = await Tesseract.recognize(processedCanvas, 'rus+ukr+eng', {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  setProgress(Math.round(m.progress * 100 * 0.3))
                }
              },
            })
            if (result1.data.confidence > bestResult.confidence) {
              bestResult = { text: result1.data.text, confidence: result1.data.confidence }
            }
          } catch (e) {
            console.warn('OCR config 1 failed:', e)
          }

          // Configuration 2: Just English with PSM 6 (uniform block of text)
          try {
            const result2 = await Tesseract.recognize(processedCanvas, 'eng', {
              tessedit_pageseg_mode: '6', // Uniform block of text
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  setProgress(30 + Math.round(m.progress * 100 * 0.3))
                }
              },
            })
            if (result2.data.confidence > bestResult.confidence) {
              bestResult = { text: result2.data.text, confidence: result2.data.confidence }
            }
          } catch (e) {
            console.warn('OCR config 2 failed:', e)
          }

          // Configuration 3: English with PSM 3 (fully automatic page segmentation)
          try {
            const result3 = await Tesseract.recognize(processedCanvas, 'eng', {
              tessedit_pageseg_mode: '3', // Fully automatic page segmentation
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  setProgress(60 + Math.round(m.progress * 100 * 0.4))
                }
              },
            })
            if (result3.data.confidence > bestResult.confidence) {
              bestResult = { text: result3.data.text, confidence: result3.data.confidence }
            }
          } catch (e) {
            console.warn('OCR config 3 failed:', e)
          }

          if (bestResult.text.trim().length < 20) {
            throw new Error('Could not extract readable text from the image. Please ensure the photo is clear, well-lit, and the text is legible.')
          }

          resolve(bestResult.text)
        } catch (error) {
          reject(new Error('Failed to process image. Please try a different photo or PDF format.'))
        }
      }

      img.onerror = () => reject(new Error('Could not load the image file. Please try a different file.'))

      const reader = new FileReader()
      reader.onload = (e) => img.src = e.target.result
      reader.onerror = () => reject(new Error('Could not read the file. Please try a different file.'))
      reader.readAsDataURL(file)
    })
  }

  async function extractFromPDF(file) {
    try {
      console.log('Starting PDF extraction for file:', file.name, 'size:', file.size)
      const arrayBuffer = await file.arrayBuffer()
      console.log('ArrayBuffer created, size:', arrayBuffer.byteLength)

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      console.log('PDF loaded, pages:', pdf.numPages)

      const chunks = []
      let hasTextContent = false

      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i}/${pdf.numPages}`)
        try {
          const page = await pdf.getPage(i)
          console.log(`Page ${i} loaded`)

          // Try native text layer first
          const textContent = await page.getTextContent()
          const nativeText = textContent.items.map((item) => item.str).join(' ')
          console.log(`Page ${i} native text length:`, nativeText.length)

          if (nativeText.trim().length > 10) {
            console.log(`Page ${i}: Using native text layer`)
            chunks.push(nativeText)
            hasTextContent = true
          } else {
            console.log(`Page ${i}: Native text too short, trying OCR`)
            // Fallback: render to canvas and OCR
            const viewport = page.getViewport({ scale: 2 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height

            const ctx = canvas.getContext('2d')
            await page.render({ canvasContext: ctx, viewport }).promise
            console.log(`Page ${i}: Rendered to canvas`)

            try {
              const result = await Tesseract.recognize(canvas, 'eng', {
                logger: (m) => console.log(`Page ${i} OCR progress:`, m)
              })
              console.log(`Page ${i}: OCR completed, confidence:`, result.data.confidence)
              chunks.push(result.data.text)
              hasTextContent = true
            } catch (ocrError) {
              console.warn(`Page ${i}: OCR failed:`, ocrError)
              // Try with different language
              try {
                const result = await Tesseract.recognize(canvas, 'rus+ukr+eng')
                chunks.push(result.data.text)
                hasTextContent = true
              } catch (fallbackError) {
                console.warn(`Page ${i}: Fallback OCR also failed:`, fallbackError)
              }
            }
          }
        } catch (pageError) {
          console.warn(`Failed to process page ${i}:`, pageError)
          // Continue with other pages
        }

        setProgress(Math.round((i / pdf.numPages) * 100))
      }

      const extractedText = chunks.join('\n').trim()
      console.log('Final extracted text length:', extractedText.length)
      console.log('Has text content:', hasTextContent)

      if (!extractedText || extractedText.length < 20) {
        if (!hasTextContent) {
          throw new Error('This PDF appears to be an image-based scan. Please upload a text-based PDF or try uploading a clear photo of the lab report instead.')
        }
        throw new Error('Could not extract readable text from PDF. The file may be corrupted, scanned at low quality, or contain only images.')
      }

      return extractedText
    } catch (error) {
      console.error('PDF processing error:', error)
      if (error.message.includes('InvalidPDFException') || error.message.includes('corrupt')) {
        throw new Error('Invalid or corrupted PDF file. Please try uploading a different PDF.')
      }
      if (error.message.includes('PasswordException')) {
        throw new Error('This PDF is password-protected. Please remove the password and try again.')
      }
      throw new Error('Could not read this PDF file. Please try another clear PDF or image.')
    }
  }

  return { processFile, progress, extractedText, ocrConfidence, isProcessing }
}
