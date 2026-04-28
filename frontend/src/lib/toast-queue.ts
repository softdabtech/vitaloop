import toast from 'react-hot-toast'

export class ToastQueue {
  private queue: Array<{ type: string; message: string; duration?: number }> = []
  private isProcessing = false

  add(type: 'success' | 'error' | 'loading', message: string, duration?: number) {
    this.queue.push({ type, message, duration })
    this.process()
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    const item = this.queue.shift()

    if (item) {
      const duration = item.duration ?? (item.type === 'error' ? 4000 : 2000)

      if (item.type === 'success') {
        toast.success(item.message, { duration })
      } else if (item.type === 'error') {
        toast.error(item.message, { duration })
      } else if (item.type === 'loading') {
        const toastId = toast.loading(item.message)
        setTimeout(() => toast.dismiss(toastId), duration)
      }

      await new Promise(resolve => setTimeout(resolve, duration + 200))
    }

    this.isProcessing = false
    if (this.queue.length > 0) {
      this.process()
    }
  }

  success(message: string, duration?: number) {
    this.add('success', message, duration)
  }

  error(message: string, duration?: number) {
    this.add('error', message, duration)
  }

  loading(message: string) {
    this.add('loading', message)
  }

  clear() {
    this.queue = []
    toast.dismiss()
  }
}

export const toastQueue = new ToastQueue()
