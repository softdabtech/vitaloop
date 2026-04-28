export interface Referral {
  code: string
  userId: string
  createdAt: Date
  referrals: ReferredUser[]
  totalRewards: number
}

export interface ReferredUser {
  userId: string
  email: string
  referredAt: Date
  completedOnboarding: boolean
  completedFirstUpload: boolean
  rewardStatus: 'pending' | 'earned' | 'redeemed'
}

export function generateReferralCode(userId: string): string {
  return `VITALOOP${userId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

export const REFERRAL_REWARDS = {
  referralJoined: 100, // points when someone signs up with your code
  referralOnboarded: 200, // when they complete onboarding
  referralFirstUpload: 500, // when they upload first lab report
  referrerBonus: 1000, // bonus for referring 5+ people
}

export function calculateReferralRewards(referrals: ReferredUser[]): {
  pendingRewards: number
  earnedRewards: number
  totalRewards: number
} {
  let pendingRewards = 0
  let earnedRewards = 0

  referrals.forEach(ref => {
    if (ref.rewardStatus === 'pending') {
      // Count based on what they've completed
      if (ref.completedFirstUpload) {
        pendingRewards += REFERRAL_REWARDS.referralFirstUpload
      } else if (ref.completedOnboarding) {
        pendingRewards += REFERRAL_REWARDS.referralOnboarded
      } else {
        pendingRewards += REFERRAL_REWARDS.referralJoined
      }
    } else if (ref.rewardStatus === 'earned') {
      if (ref.completedFirstUpload) {
        earnedRewards += REFERRAL_REWARDS.referralFirstUpload
      } else if (ref.completedOnboarding) {
        earnedRewards += REFERRAL_REWARDS.referralOnboarded
      } else {
        earnedRewards += REFERRAL_REWARDS.referralJoined
      }
    }
  })

  // Bonus for 5+ referrals
  if (referrals.filter(r => r.completedFirstUpload).length >= 5) {
    earnedRewards += REFERRAL_REWARDS.referrerBonus
  }

  return {
    pendingRewards,
    earnedRewards,
    totalRewards: pendingRewards + earnedRewards,
  }
}

export function getRewardDescription(status: 'pending' | 'earned'): string {
  if (status === 'pending') {
    return 'Points will be awarded once they complete the action'
  }
  return 'Points earned! You can use them for premium features'
}

export function generateReferralShareText(code: string, userName?: string): string {
  return `Hey! 👋 I'm using VITALOOP to track my health with AI. Use my referral code ${code} to get started and we both get rewards! 🎁`
}

export function generateReferralLink(code: string): string {
  return `${window.location.origin}/join?ref=${code}`
}
