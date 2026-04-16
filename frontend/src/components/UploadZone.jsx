import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function UploadZone({ onFile, disabled = false }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    disabled,
    noClick: true,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition ${
        disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : isDragActive
            ? 'border-teal-500 bg-teal-50 cursor-copy'
            : 'border-gray-300 bg-white hover:border-teal-400 cursor-pointer'
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-4xl mb-3">📄</div>
      <p className="text-gray-800 font-semibold">
        {isDragActive ? 'Drop your file here' : 'Drag and drop your lab PDF or photo'}
      </p>
      <p className="text-gray-500 text-sm mt-1">PDF, JPG, PNG supported. Max 20MB.</p>

      <button
        type="button"
        disabled={disabled}
        onClick={open}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Choose File
      </button>

      <p className="text-teal-700 text-xs mt-3">Local-first OCR. Raw file does not leave your device.</p>
    </div>
  )
}
