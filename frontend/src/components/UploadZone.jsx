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
      className={`vtl-upload-zone flex flex-col items-center justify-center px-6 py-10 text-center transition ${
        disabled
          ? 'cursor-not-allowed border-slate-600 bg-slate-900/70'
          : isDragActive
            ? 'cursor-copy border-emerald-300 bg-emerald-500/15'
            : 'cursor-pointer hover:border-emerald-300 hover:bg-emerald-500/10'
      }`}
    >
      <input {...getInputProps()} />
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/20 text-4xl ring-1 ring-emerald-400/35">📄</div>
      <p className="text-xl font-semibold text-slate-100 sm:text-2xl">
        {isDragActive ? 'Drop your file here' : 'Drag and drop your lab PDF or photo'}
      </p>
      <p className="mt-2 text-sm text-slate-400">PDF, JPG, PNG supported. Max 20MB.</p>

      <button
        type="button"
        disabled={disabled}
        onClick={open}
        className="vtl-button-primary vtl-focus-ring mt-5 inline-flex items-center justify-center px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        Choose File
      </button>

      <p className="mt-3 text-xs text-emerald-300">Local-first OCR. Raw file does not leave your device.</p>
    </div>
  )
}
