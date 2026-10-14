import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SupportChat from './SupportChat.jsx'

describe('SupportChat mobile shell contract', () => {
  beforeEach(() => {
    globalThis.Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    delete globalThis.Element.prototype.scrollIntoView
    vi.restoreAllMocks()
  })

  it('uses the shared mobile offset class so the panel clears cabinet navigation', () => {
    render(<SupportChat onClose={() => {}} />)

    expect(screen.getByPlaceholderText('Type a question...').parentElement.parentElement.className).toContain(
      'vtl-support-chat-panel',
    )
  })
})
