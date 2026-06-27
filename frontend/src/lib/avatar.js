/**
 * Avatar utilities — client-side resize, initials, Supabase user_metadata storage.
 * No backend calls, no storage buckets — avatar stored as JPEG base64 in user_metadata.
 */

const AVATAR_SIZE = 256     // px
const JPEG_QUALITY = 0.78   // ~30-50 KB at 256x256

/** Resize & convert File → base64 JPEG data-URL */
export async function resizeToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE

      const ctx = canvas.getContext('2d')
      // Cover crop — center the image
      const ratio = Math.max(AVATAR_SIZE / img.naturalWidth, AVATAR_SIZE / img.naturalHeight)
      const w = img.naturalWidth * ratio
      const h = img.naturalHeight * ratio
      ctx.drawImage(img, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) / 2, w, h)

      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = reject
    img.src = url
  })
}

/** Initials from name or email */
export function getInitials(name, email) {
  const src = String(name || email || '').trim()
  if (!src) return '?'
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

/** Deterministic gradient from user id / email */
export function getAvatarGradient(seed) {
  const s = String(seed || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = h % 360
  return [
    `hsl(${hue}, 58%, 42%)`,
    `hsl(${(hue + 40) % 360}, 62%, 55%)`,
  ]
}

/** Read avatar_url from Supabase user object */
export function getAvatarUrl(user) {
  return (
    user?.user_metadata?.avatar_url ||
    user?.identities?.[0]?.identity_data?.avatar_url ||  // Google avatar
    null
  )
}

/** Save avatar data-URL to Supabase user_metadata */
export async function saveAvatarToSupabase(supabase, dataUrl) {
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: dataUrl },
  })
  if (error) throw error
}

/** Remove avatar from Supabase user_metadata */
export async function removeAvatarFromSupabase(supabase) {
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: null },
  })
  if (error) throw error
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
export const MAX_FILE_MB = 10
