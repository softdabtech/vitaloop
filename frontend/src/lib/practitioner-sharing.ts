import api from './api'

export interface PractitionerShare {
  id: string
  uploadId: string
  practitionerEmail: string
  practitionerName: string
  shareToken: string
  accessLevel: 'view' | 'comment' | 'export'
  expiresAt: string
  createdAt: string
  lastAccessedAt?: string
}

export interface SharePermissions {
  canView: boolean
  canComment: boolean
  canExport: boolean
}

// Generate a secure sharing token for practitioners
export function generateShareToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Share results with a practitioner
export async function shareToPractitioner(
  uploadId: string,
  practitionerEmail: string,
  practitionerName: string,
  accessLevel: 'view' | 'comment' | 'export' = 'view',
  expiresInDays: number = 30
): Promise<PractitionerShare> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const { data } = await api.post('/sharing/practitioners', {
    uploadId,
    practitionerEmail,
    practitionerName,
    accessLevel,
    expiresAt: expiresAt.toISOString(),
  })

  return data
}

// Get all practitioner shares for an upload
export async function getPractitionerShares(uploadId: string): Promise<PractitionerShare[]> {
  const { data } = await api.get(`/sharing/practitioners/${uploadId}`)
  return data.shares || []
}

// Revoke access to practitioner share
export async function revokePractitionerAccess(shareId: string): Promise<void> {
  await api.delete(`/sharing/practitioners/${shareId}`)
}

// Update access level for a share
export async function updateShareAccessLevel(
  shareId: string,
  accessLevel: 'view' | 'comment' | 'export'
): Promise<PractitionerShare> {
  const { data } = await api.patch(`/sharing/practitioners/${shareId}`, { accessLevel })
  return data
}

// Check if a share token is valid and get permissions
export async function validateShareToken(token: string): Promise<{
  valid: boolean
  permissions: SharePermissions
  upload?: any
  practitionerName?: string
}> {
  try {
    const { data } = await api.get(`/sharing/validate-token/${token}`)
    return {
      valid: true,
      permissions: {
        canView: ['view', 'comment', 'export'].includes(data.accessLevel),
        canComment: ['comment', 'export'].includes(data.accessLevel),
        canExport: data.accessLevel === 'export',
      },
      upload: data.upload,
      practitionerName: data.practitionerName,
    }
  } catch {
    return {
      valid: false,
      permissions: { canView: false, canComment: false, canExport: false },
    }
  }
}

// Log practitioner access
export async function logPractitionerAccess(shareId: string): Promise<void> {
  await api.post(`/sharing/practitioners/${shareId}/log-access`)
}

// Get share analytics
export async function getShareAnalytics(uploadId: string): Promise<{
  totalShares: number
  activeShares: number
  accessLog: Array<{
    practitionerEmail: string
    lastAccessed?: string
    accessCount: number
  }>
}> {
  const { data } = await api.get(`/sharing/analytics/${uploadId}`)
  return data
}
