import { trackFunnelEvent } from './funnel.js'

export const funnelEvents = {
  // Registration funnel
  signupStarted: () => trackFunnelEvent('funnel_signup_started', 'User started signup'),
  signupCompleted: (method: string) => trackFunnelEvent('funnel_signup_completed', 'User completed signup', { method }),
  emailConfirmed: () => trackFunnelEvent('funnel_email_confirmed', 'User confirmed email'),

  // Onboarding funnel
  onboardingStarted: () => trackFunnelEvent('funnel_onboarding_started', 'User started onboarding'),
  onboardingStep: (step: number) => trackFunnelEvent(`funnel_onboarding_step_${step}`, `Completed onboarding step ${step}`),
  onboardingCompleted: () => trackFunnelEvent('funnel_onboarding_completed', 'User completed onboarding'),

  // Upload funnel
  uploadStarted: () => trackFunnelEvent('funnel_upload_started', 'User started upload'),
  uploadSuccess: (fileSize: number) => trackFunnelEvent('funnel_upload_success', 'File uploaded', { fileSize }),
  analysisStarted: () => trackFunnelEvent('funnel_analysis_started', 'Analysis started'),
  analysisCompleted: (markerCount: number) => trackFunnelEvent('funnel_analysis_completed', 'Analysis completed', { markerCount }),

  // Protocol funnel
  protocolViewed: () => trackFunnelEvent('funnel_protocol_viewed', 'User viewed protocol'),
  protocolUpgradeClicked: () => trackFunnelEvent('funnel_protocol_upgrade_clicked', 'User clicked upgrade for full protocol'),

  // Retention
  checkInSubmitted: () => trackFunnelEvent('funnel_checkin_submitted', 'Weekly check-in submitted'),
  insightsGenerated: (count: number) => trackFunnelEvent('funnel_insights_generated', 'Insights generated', { count }),
}
