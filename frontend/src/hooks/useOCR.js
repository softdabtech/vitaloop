import { useState, useRef } from 'react'
import * as Tesseract from 'tesseract.js'
// import * as pdfjsLib from 'pdfjs-dist' // Temporarily disabled to avoid worker issues

// Configure PDF.js to work without worker to avoid SES conflicts
if (typeof window !== 'undefined') {
  // Don't set workerSrc to avoid loading issues - PDF.js will work in synchronous mode
  // pdfjsLib.GlobalWorkerOptions.workerSrc = undefined
}

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

      // For now, use OCR for all PDFs since PDF.js causes SES issues
      // Convert PDF pages to images and OCR them
      console.log('Converting PDF to images for OCR processing')

      // We'll need to implement PDF to image conversion
      // For now, return a placeholder message
      throw new Error('PDF processing temporarily disabled due to security restrictions. Please upload a clear photo of your lab report instead.')

      // Future implementation would use:
      // 1. PDF.js in a web worker (but that causes SES issues)
      // 2. Server-side PDF processing
      // 3. Alternative PDF libraries

    } catch (error) {
      console.error('PDF processing error:', error)
      if (error.message.includes('InvalidPDFException') || error.message.includes('corrupt')) {
        throw new Error('Invalid or corrupted PDF file. Please try uploading a different PDF.')
      }
      if (error.message.includes('PasswordException')) {
        throw new Error('This PDF is password-protected. Please remove the password and try again.')
      }
      throw new Error('PDF processing is currently unavailable. Please upload a clear photo of your lab report instead.')
    }
  }

  return { processFile, progress, extractedText, ocrConfidence, isProcessing }
}
