import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { isUkrainianLocale } from '../lib/locale.js'

function resolveRejectionMessage(rejection, isUk = false) {
  const code = rejection?.errors?.[0]?.code

  if (code === 'file-too-large') {
    return isUk ? 'Файл завеликий. Завантажте файл до 20MB.' : 'File is too large. Please upload a file under 20MB.'
  }
  if (code === 'file-invalid-type') {
    return isUk ? 'Непідтримуваний тип файлу. Завантажте PDF, зображення, XLS/XLSX або CSV.' : 'Unsupported file type. Please upload a PDF, image, XLS/XLSX, or CSV file.'
  }
  if (code === 'too-many-files') {
    return isUk ? 'Завантажуйте один бланк аналізів за раз.' : 'Please upload one lab report at a time.'
  }

  return isUk ? 'Не вдалося прийняти файл. Завантажте PDF, зображення, XLS/XLSX або CSV до 20MB.' : 'Could not accept this file. Please upload a PDF, image, XLS/XLSX, or CSV under 20MB.'
}

export default function UploadZone({ onFile, onError, disabled = false }) {
  const isUk = isUkrainianLocale()
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const onDropRejected = useCallback((rejections) => {
    if (rejections[0]) onError?.(resolveRejectionMessage(rejections[0], isUk))
  }, [isUk, onError])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    disabled,
    noClick: true,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tiff', '.tif'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  })

  return (
    <div
      {...getRootProps()}
      className={`vtl-upload-zone flex flex-col items-center justify-center px-6 py-10 text-center transition ${
        disabled
          ? 'cursor-not-allowed border-slate-300 bg-slate-50/90'
          : isDragActive
            ? 'cursor-copy border-emerald-400 bg-emerald-50'
            : 'cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/60'
      }`}
    >
      <input {...getInputProps()} />
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-4xl ring-1 ring-emerald-300">📄</div>
      <p className="text-xl font-semibold text-slate-800 sm:text-2xl">
        {isDragActive
          ? (isUk ? 'Відпустіть файл тут' : 'Drop your lab report here')
          : (isUk ? 'Перетягніть файл з аналізами' : 'Drag and drop your lab report')}
      </p>
      <p className="mt-2 text-sm text-slate-500">{isUk ? 'PDF, зображення, XLS/XLSX або CSV. До 20MB.' : 'PDF, images, XLS/XLSX, or CSV. Max 20MB.'}</p>

      <button
        type="button"
        disabled={disabled}
        onClick={open}
        className="vtl-button-primary vtl-focus-ring mt-5 inline-flex items-center justify-center px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUk ? 'Обрати файл' : 'Choose File'}
      </button>

      <p className="mt-3 text-xs text-emerald-700">
        {isUk ? 'Файл безпечно завантажується для структурованого аналізу показників.' : 'Your file is securely uploaded for structured biomarker analysis.'}
      </p>
    </div>
  )
}
