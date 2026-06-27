import { useState, useRef } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import {
  resizeToBase64,
  saveAvatarToSupabase,
  removeAvatarFromSupabase,
  getAvatarUrl,
  getInitials,
  getAvatarGradient,
  ACCEPTED_TYPES,
  MAX_FILE_MB,
} from '../lib/avatar.js'

/**
 * Avatar upload widget for Settings page.
 * Handles: pick file → resize → base64 → save to user_metadata.
 */
export default function AvatarUpload({ user, onUpdate, isUk = false }) {
  const [loading, setLoading]   = useState(false)
  const [preview, setPreview]   = useState(null)   // local preview before save
  const inputRef = useRef(null)

  const currentUrl   = preview || getAvatarUrl(user)
  const displayName  = user?.user_metadata?.full_name || user?.email || ''
  const initials     = getInitials(displayName, user?.email)
  const [g1, g2]    = getAvatarGradient(user?.id || user?.email || '')

  const T = isUk ? {
    title:    'Фото профілю',
    subtitle: 'Додайте фото або зображення. Воно відображатиметься у кабінеті.',
    upload:   'Завантажити фото',
    remove:   'Видалити',
    saving:   'Збереження…',
    tip:      'JPG, PNG, WebP до 10 MB. Автоматично обрізається до квадрату.',
    saved:    'Аватар збережено',
    removed:  'Аватар видалено',
    typeErr:  'Непідтримуваний формат. Використовуйте JPG, PNG або WebP.',
    sizeErr:  `Файл завеликий. Максимум ${MAX_FILE_MB} MB.`,
    saveErr:  'Не вдалося зберегти. Спробуйте ще раз.',
  } : {
    title:    'Profile photo',
    subtitle: 'Add a photo or image. It will appear throughout your cabinet.',
    upload:   'Upload photo',
    remove:   'Remove',
    saving:   'Saving…',
    tip:      'JPG, PNG, WebP up to 10 MB. Auto-cropped to square.',
    saved:    'Avatar saved',
    removed:  'Avatar removed',
    typeErr:  'Unsupported format. Use JPG, PNG or WebP.',
    sizeErr:  `File too large. Maximum ${MAX_FILE_MB} MB.`,
    saveErr:  'Could not save. Please try again.',
  }

  async function handleFile(file) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) { toast.error(T.typeErr); return }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast.error(T.sizeErr); return }

    setLoading(true)
    try {
      const dataUrl = await resizeToBase64(file)
      setPreview(dataUrl)
      await saveAvatarToSupabase(supabase, dataUrl)
      toast.success(T.saved)
      onUpdate?.()
    } catch {
      toast.error(T.saveErr)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeAvatarFromSupabase(supabase)
      setPreview(null)
      toast.success(T.removed)
      onUpdate?.()
    } catch {
      toast.error(T.saveErr)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>{T.title}</div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>{T.subtitle}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Avatar preview */}
        <div
          onClick={() => !loading && inputRef.current?.click()}
          style={{
            position: 'relative', width: 88, height: 88, borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0, cursor: loading ? 'default' : 'pointer',
            background: currentUrl ? 'transparent' : `linear-gradient(135deg, ${g1}, ${g2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
            transition: 'box-shadow 0.2s',
          }}
        >
          {currentUrl
            ? <img src={currentUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>{initials}</span>
          }
          {/* Hover overlay */}
          {!loading && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(15,23,42,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.18s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
            >
              <Camera size={22} color="#fff" />
            </div>
          )}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(15,23,42,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '2.5px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.7s linear infinite',
              }}/>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 100, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
              color: '#fff', fontWeight: 700, fontSize: 13.5,
              boxShadow: '0 4px 14px rgba(15,118,110,0.28)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Upload size={15} />
            {loading ? T.saving : T.upload}
          </button>

          {currentUrl && !loading && (
            <button
              onClick={handleRemove}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 100,
                border: '1.5px solid #e2e8f0', background: 'transparent',
                color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              {T.remove}
            </button>
          )}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{T.tip}</p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
