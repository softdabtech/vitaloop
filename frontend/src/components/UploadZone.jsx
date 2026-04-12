import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function UploadZone({ onFile }) {
  const onDrop = useCallback((accepted) => {
    if (accepted[0]) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
        isDragActive ? 'border-green-400 bg-green-900/10' : 'border-gray-700 hover:border-gray-500'
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-4xl mb-3">📄</div>
      <p className="text-gray-300 font-medium">
        {isDragActive ? 'Drop your file here' : 'Drag & drop your lab PDF or photo'}
      </p>
      <p className="text-gray-500 text-sm mt-1">PDF, JPG, PNG supported · Max 20MB</p>
      <p className="text-green-600 text-xs mt-3">🔒 Your file never leaves your device</p>
    </div>
  )
}
