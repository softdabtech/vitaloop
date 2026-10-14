import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SupportChat from './SupportChat.jsx'

beforeEach(() => {
  globalThis.Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  delete globalThis.Element.prototype.scrollIntoView
  vi.restoreAllMocks()
})

function SupportChatHarness() {
  const [open, setOpen] = useState(false)
  const launcherRef = useRef(null)
  const wasOpenRef = useRef(false)
  const closeReasonRef = useRef('user')
  useEffect(() => {
    if (!open && wasOpenRef.current && closeReasonRef.current !== 'navigation') {
      launcherRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])
  return (
    <>
      <button ref={launcherRef} type="button" onClick={() => setOpen(true)}>Launch support chat</button>
      {open && <SupportChat onClose={(reason) => {
        closeReasonRef.current = reason
        setOpen(false)
      }} />}
    </>
  )
}

describe('SupportChat mobile shell contract', () => {
  it('uses the shared mobile offset class so the panel clears cabinet navigation', () => {
    render(<SupportChat onClose={() => {}} />)

    expect(screen.getByPlaceholderText('Type a question...').parentElement.parentElement.className).toContain(
      'vtl-support-chat-panel',
    )
  })

  it.each(['plan', 'account'])('closes when the %s submenu opens', (openSubnav) => {
    const onClose = vi.fn()
    render(<SupportChat onClose={onClose} />)

    window.dispatchEvent(new CustomEvent('vtl-mobile-subnav-change', { detail: { openSubnav } }))

    expect(onClose).toHaveBeenCalledWith('navigation')
  })
})

describe('SupportChat accessibility and keyboard behavior', () => {
  it('exposes a named non-modal dialog, labelled controls, and a live message log', () => {
    const { container } = render(<SupportChat onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'VITALOOP Support' })
    const log = screen.getByRole('log', { name: 'Support chat messages' })

    expect(dialog.getAttribute('aria-modal')).toBe('false')
    expect(screen.getByRole('button', { name: 'Close support chat' })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: 'Message' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Send message' })).not.toBeNull()
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(container.contains(dialog)).toBe(true)
  })

  it('focuses the message input when mounted and returns focus to the launcher when closed', async () => {
    render(<SupportChatHarness />)
    const launcher = screen.getByRole('button', { name: 'Launch support chat' })
    fireEvent.click(launcher)

    const input = screen.getByRole('textbox', { name: 'Message' })
    await waitFor(() => expect(document.activeElement).toBe(input))
    fireEvent.click(screen.getByRole('button', { name: 'Close support chat' }))

    await waitFor(() => expect(document.activeElement).toBe(launcher))
  })

  it('closes on Escape and restores focus to the launcher', async () => {
    render(<SupportChatHarness />)
    const launcher = screen.getByRole('button', { name: 'Launch support chat' })
    fireEvent.click(launcher)
    const input = screen.getByRole('textbox', { name: 'Message' })
    await waitFor(() => expect(document.activeElement).toBe(input))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'VITALOOP Support' })).toBeNull()
    expect(document.activeElement).toBe(launcher)
  })

  it('announces a submitted message and does not steal focus on navigation closure', async () => {
    render(<SupportChatHarness />)
    const launcher = screen.getByRole('button', { name: 'Launch support chat' })
    fireEvent.click(launcher)

    const input = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(input, { target: { value: 'A synthetic question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    const log = screen.getByRole('log', { name: 'Support chat messages' })
    expect(log.textContent).toContain('A synthetic question')
    await waitFor(() => expect(log.textContent).toContain(
      'Great question - our team will get back to you within a few hours.',
    ))

    await waitFor(() => expect(document.activeElement).toBe(input))
    act(() => {
      window.dispatchEvent(new CustomEvent('vtl-mobile-subnav-change', { detail: { openSubnav: 'account' } }))
    })
    expect(screen.queryByRole('dialog', { name: 'VITALOOP Support' })).toBeNull()
    expect(document.activeElement).not.toBe(launcher)
  })
})
