import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

function resolveRejectionMessage(rejection) {
  const code = rejection?.errors?.[0]?.code

  if (code === 'file-too-large') {
    return 'File is too large. Please upload a file under 20MB.'
  }
  if (code === 'file-invalid-type') {
    return 'Unsupported file type. Please upload a PDF file.'
  }
  if (code === 'too-many-files') {
    return 'Please upload one lab report at a time.'
  }

  return 'Could not accept this file. Please upload a PDF file under 20MB.'
}

export default function UploadZone({ onFile, onError, disabled = false }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const onDropRejected = useCallback((rejections) => {
    if (rejections[0]) onError?.(resolveRejectionMessage(rejections[0]))
  }, [onError])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    disabled,
    noClick: true,
    accept: {
      'application/pdf': ['.pdf'],
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
        {isDragActive ? 'Drop your lab report here' : 'Drag and drop your lab report'}
      </p>
      <p className="mt-2 text-sm text-slate-500">PDF only. Max 20MB.</p>

      <button
        type="button"
        disabled={disabled}
        onClick={open}
        className="vtl-button-primary vtl-focus-ring mt-5 inline-flex items-center justify-center px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        Choose File
      </button>

      <p className="mt-3 text-xs text-emerald-700">Your PDF is securely uploaded for structured biomarker analysis.</p>
    </div>
  )
}
