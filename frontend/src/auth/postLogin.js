import api from '../lib/api.js'

export const AUTH_POST_LOGIN_PATH = import.meta.env.VITE_AUTH_POST_LOGIN_PATH || '/auth/post-login'

function normalizeRole(value) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function hasOrgAdminMembership(memberships = []) {
  return memberships.some((membership) => {
    const status = normalizeRole(membership?.status)
    const role = normalizeRole(membership?.role)
    return status === 'active' && (role === 'org_owner' || role === 'client_admin')
  })
}

function resolveFromUserMetadata(user) {
  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}

  const isSuperAdmin = Boolean(meta.is_super_admin || app.is_super_admin)
  if (isSuperAdmin) {
    return '/ops'
  }

  const isAdmin = Boolean(
    meta.is_admin ||
    app.is_admin ||
    normalizeRole(meta.role) === 'admin' ||
    normalizeRole(app.role) === 'admin' ||
    normalizeRole(meta.global_role) === 'admin' ||
    normalizeRole(app.global_role) === 'admin'
  )

  return isAdmin ? '/admin' : '/dashboard'
}

function resolveFromAuthContext(ctx, fallbackUser) {
  if (!ctx || typeof ctx !== 'object') {
    return resolveFromUserMetadata(fallbackUser)
  }

  if (ctx.pending_invite || ctx.pendingInvite) {
    return '/invitations/accept'
  }

  const onboardingCompleted =
    typeof ctx.onboarding_completed === 'boolean'
      ? ctx.onboarding_completed
      : ctx.onboardingCompleted

  if (onboardingCompleted === false) {
    return '/onboarding'
  }

  const globalRole = normalizeRole(ctx.global_role || ctx.globalRole)
  if (globalRole === 'super_admin') {
    return '/ops'
  }

  if (hasOrgAdminMembership(ctx.memberships || [])) {
    return '/admin'
  }

  return '/dashboard'
}

export function requiresHardRedirect(pathname) {
  return pathname === '/invitations/accept'
}

export function navigateToResolvedPath(navigate, pathname) {
  if (requiresHardRedirect(pathname)) {
    window.location.assign(pathname)
    return
  }

  navigate(pathname, { replace: true })
}

export async function resolvePostLoginDestination(user) {
  try {
    const { data } = await api.get('/auth/me')
    return resolveFromAuthContext(data, user)
  } catch {
    try {
      const { data } = await api.get('/profile')
      const onboardingComplete = data?.profile?.onboarding_complete
      if (onboardingComplete === false) {
        return '/onboarding'
      }
    } catch {
      // ignore fallback profile errors
    }

    return resolveFromUserMetadata(user)
  }
}
