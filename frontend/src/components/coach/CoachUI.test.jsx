import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoachButton, CoachCard, CoachInput } from './CoachUI.jsx'

const coachStyles = readFileSync(
  resolve(cwd(), 'src/styles/coach-design-system.css'),
  'utf8',
)

describe('coach shared primitives', () => {
  it('keeps the shared primary button semantic and usable when disabled', () => {
    render(<CoachButton disabled>Continue</CoachButton>)

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button.disabled).toBe(true)
    expect(button.className).toContain('coach-button--primary')
    expect(coachStyles).toContain('min-height: 44px')
    expect(coachStyles).toContain('background: var(--vtl-action-primary-bg)')
    expect(coachStyles).toContain('outline: 3px solid var(--vtl-color-focus-ring)')
  })

  it('uses canonical card and field contracts without changing component APIs', () => {
    render(
      <CoachCard aria-label="Example card">
        <CoachInput label="Email" error="Required"><input /></CoachInput>
      </CoachCard>,
    )

    expect(screen.getByLabelText('Example card').className).toContain('coach-card')
    expect(screen.getByText('Required')).toBeTruthy()
    expect(coachStyles).toContain('border-radius: var(--vtl-radius-card)')
    expect(coachStyles).toContain('border-radius: var(--vtl-radius-field)')
  })
})
