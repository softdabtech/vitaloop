export const socialSharing = {
  shareViaEmail: (email: string, subject: string, body: string) => {
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  },

  shareOnTwitter: (text: string, url?: string) => {
    const tweetText = encodeURIComponent(`${text} ${url ? url : ''}`)
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank')
  },

  shareOnLinkedIn: (title: string, url: string, description: string) => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank'
    )
  },

  shareViaWhatsApp: (text: string, url?: string) => {
    const message = encodeURIComponent(`${text} ${url ? url : ''}`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  },

  copyToClipboard: async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.error('Failed to copy:', err)
      return false
    }
  },

  shareReportLink: (reportId: string, title: string) => {
    const url = `${window.location.origin}/results/${reportId}`
    return {
      title: `Check out my ${title} report from VITALOOP`,
      url,
      description: 'Track your biomarkers and get AI-powered health insights',
    }
  },

  generateShareableLink: (uploadId: string, expiresIn: number = 7 * 24 * 60 * 60 * 1000) => {
    return {
      uploadId,
      expiresAt: new Date(Date.now() + expiresIn),
      shareUrl: `${window.location.origin}/share/${uploadId}`,
    }
  },
}
