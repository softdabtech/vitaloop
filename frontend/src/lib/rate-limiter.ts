export class RateLimiter {
  private attempts: Record<string, number[]> = {}
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 5, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  canProceed(key: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    if (!this.attempts[key]) {
      this.attempts[key] = []
    }

    // Remove old attempts outside the window
    this.attempts[key] = this.attempts[key].filter(time => time > windowStart)

    if (this.attempts[key].length < this.maxRequests) {
      this.attempts[key].push(now)
      return true
    }

    return false
  }

  getWaitTime(key: string): number {
    if (!this.attempts[key] || this.attempts[key].length === 0) return 0

    const oldestAttempt = this.attempts[key][0]
    const waitMs = this.windowMs - (Date.now() - oldestAttempt)

    return Math.max(0, Math.ceil(waitMs / 1000))
  }

  reset(key: string) {
    delete this.attempts[key]
  }
}

export const apiLimiter = new RateLimiter(10, 60000) // 10 requests per minute
export const analyzeUploadLimiter = new RateLimiter(2, 300000) // 2 uploads per 5 minutes
export const generateInsightsLimiter = new RateLimiter(3, 300000) // 3 generations per 5 minutes
