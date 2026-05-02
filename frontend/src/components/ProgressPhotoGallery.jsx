import { useState, useRef } from 'react'
import { Upload, Camera, Trash2, Plus, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProgressPhotoGallery({ photos = [], onUpload, onDelete }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo must be less than 10MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('taken_at', new Date().toISOString())

      await onUpload(formData)
      toast.success('Photo added to your progress gallery!')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      toast.error('Failed to upload photo')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const sortedPhotos = [...photos].sort((a, b) =>
    new Date(b.taken_at) - new Date(a.taken_at)
  )

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-8">
        <div className="text-center">
          <Camera className="h-10 w-10 text-blue-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-900 mb-1">Track Your Progress</h3>
          <p className="text-sm text-blue-700 mb-4">
            Take a photo of yourself to see your transformation journey
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>

          <p className="text-xs text-blue-600 mt-3">
            JPG, PNG, or GIF up to 10MB
          </p>
        </div>
      </div>

      {/* Gallery */}
      {sortedPhotos.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Your Journey ({sortedPhotos.length} photo{sortedPhotos.length > 1 ? 's' : ''})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPhotos.map((photo, idx) => (
              <div
                key={photo.id || idx}
                className="group relative rounded-2xl overflow-hidden bg-slate-100 aspect-square"
              >
                <img
                  src={photo.url}
                  alt={`Progress photo ${idx + 1}`}
                  className="w-full h-full object-cover transition group-hover:scale-105"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end">
                  <div className="w-full p-3 bg-gradient-to-t from-black/60 to-transparent text-white">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="h-4 w-4" />
                      {formatDate(photo.taken_at)}
                    </div>
                  </div>
                </div>

                {/* Delete Button */}
                {onDelete && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this photo?')) {
                        onDelete(photo.id)
                        toast.success('Photo deleted')
                      }
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Motivational Message */}
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm text-emerald-800">
              💪 {sortedPhotos.length} snapshot{sortedPhotos.length > 1 ? 's' : ''} of your health journey. You're building momentum!
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <Camera className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No progress photos yet</p>
          <p className="text-sm text-slate-600 mt-1">
            Upload your first photo to start tracking your visual progress
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-2">💡 TIPS FOR BEST RESULTS:</p>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>✓ Use consistent lighting and background</li>
          <li>✓ Take photos at the same time of day</li>
          <li>✓ Wear similar clothing for easy comparison</li>
          <li>✓ Monthly photos show clearest changes</li>
        </ul>
      </div>
    </div>
  )
}
