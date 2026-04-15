import { useMemo } from 'react'
import { useAuth } from './useAuth.js'

function deriveRole(user) {
  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}

  if (meta.global_role) return meta.global_role
  if (app.global_role) return app.global_role
  if (meta.is_super_admin || app.is_super_admin) return 'super_admin'
  if (meta.org_role === 'admin' || app.org_role === 'admin') return 'org_admin'
  if (meta.role === 'practitioner' || app.role === 'practitioner') return 'practitioner'
  return 'end_user'
}

export function useCRMRoleAccess() {
  const { user, loading } = useAuth()

  return useMemo(() => {
    const role = deriveRole(user)
    const isSuperAdmin = role === 'super_admin'
    const isOrgAdmin = role === 'org_admin'
    const isPractitioner = role === 'practitioner'
    const isEndUser = role === 'end_user'

    return {
      user,
      loading,
      role,
      isSuperAdmin,
      isOrgAdmin,
      isPractitioner,
      isEndUser,
      canAccessCRM: isSuperAdmin || isOrgAdmin || isPractitioner,
      canAccessOps: isSuperAdmin,
      canManagePrograms: isSuperAdmin || isOrgAdmin,
      canManageClients: isSuperAdmin || isOrgAdmin || isPractitioner,
      canAssignPractitioner: isSuperAdmin || isOrgAdmin,
      canCreateIntervention: isSuperAdmin || isOrgAdmin || isPractitioner,
    }
  }, [user, loading])
}
