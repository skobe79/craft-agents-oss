/**
 * Lark interactive-card builder tests.
 *
 * Schema 2.0 layout, label truncation, button cap, and the cleared-card
 * shape used by `clearButtons`.
 */
import { describe, expect, it } from 'bun:test'
import {
  buildLarkCard,
  buildClearedCard,
  isLarkEditExpiredError,
  LARK_MAX_BUTTONS,
  LARK_MAX_LABEL_LENGTH,
} from '../card'
import type { InlineButton } from '../../../types'

describe('buildLarkCard', () => {
  const messageId = 'msg-abc-123'

  it('wraps elements under `body` (schema 2.0 envelope)', () => {
    // Regression guard: top-level `elements` is rejected with code 200621
    // ("unknown property, property: elements") on Lark schema 2.0 — the
    // payload must nest elements under `body`. This test locks the wrapper.
    const card = buildLarkCard('hi', [{ id: 'a', label: 'A' }], { messageId })
    expect(card.body).toBeTruthy()
    expect(Array.isArray(card.body.elements)).toBe(true)
    expect((card as unknown as { elements?: unknown }).elements).toBeUndefined()
  })

  it('produces schema 2.0 with text body + action row', () => {
    const buttons: InlineButton[] = [
      { id: 'accept', label: 'Accept' },
      { id: 'reject', label: 'Reject' },
    ]
    const card = buildLarkCard('Plan ready. Approve?', buttons, { messageId })
    expect(card.schema).toBe('2.0')
    expect(card.body.elements.length).toBe(2)
    expect(card.body.elements[0]!.tag).toBe('div')
    expect(card.body.elements[1]!.tag).toBe('action')

    if (card.body.elements[1]!.tag === 'action') {
      const actions = card.body.elements[1]!.actions
      expect(actions.length).toBe(2)
      expect(actions[0]!.text.content).toBe('Accept')
      expect(actions[0]!.value.buttonId).toBe('accept')
      expect(actions[0]!.value.messageId).toBe(messageId)
      // First button gets primary visual treatment
      expect(actions[0]!.type).toBe('primary')
      expect(actions[1]!.type).toBe('default')
    }
  })

  it('truncates labels longer than LARK_MAX_LABEL_LENGTH', () => {
    const longLabel = 'a'.repeat(LARK_MAX_LABEL_LENGTH + 5)
    const buttons: InlineButton[] = [{ id: 'x', label: longLabel }]
    const card = buildLarkCard('hi', buttons, { messageId })
    if (card.body.elements[1]!.tag === 'action') {
      const truncated = card.body.elements[1]!.actions[0]!.text.content
      expect(truncated.length).toBe(LARK_MAX_LABEL_LENGTH)
      // Last char becomes the ellipsis
      expect(truncated.endsWith('…')).toBe(true)
    }
  })

  it('caps button count at LARK_MAX_BUTTONS', () => {
    const buttons: InlineButton[] = Array.from({ length: LARK_MAX_BUTTONS + 5 }, (_, i) => ({
      id: `b${i}`,
      label: `Btn ${i}`,
    }))
    const card = buildLarkCard('hi', buttons, { messageId })
    if (card.body.elements[1]!.tag === 'action') {
      expect(card.body.elements[1]!.actions.length).toBe(LARK_MAX_BUTTONS)
    }
  })

  it('forwards button.data into the value payload when set', () => {
    const buttons: InlineButton[] = [{ id: 'x', label: 'X', data: 'extra-payload' }]
    const card = buildLarkCard('hi', buttons, { messageId })
    if (card.body.elements[1]!.tag === 'action') {
      expect(card.body.elements[1]!.actions[0]!.value.data).toBe('extra-payload')
    }
  })
})

describe('buildClearedCard', () => {
  it('drops the action row, keeps only the text body, still under body', () => {
    const card = buildClearedCard('Done.')
    expect(card.body.elements.length).toBe(1)
    expect(card.body.elements[0]!.tag).toBe('div')
    expect((card as unknown as { elements?: unknown }).elements).toBeUndefined()
  })
})

describe('isLarkEditExpiredError', () => {
  it('matches the documented edit-expired error codes', () => {
    expect(isLarkEditExpiredError({ code: 230003 })).toBe(true)
    expect(isLarkEditExpiredError({ code: 234001 })).toBe(true)
    expect(isLarkEditExpiredError({ response: { code: 230003 } })).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isLarkEditExpiredError({ code: 99999 })).toBe(false)
    expect(isLarkEditExpiredError(new Error('network'))).toBe(false)
    expect(isLarkEditExpiredError(null)).toBe(false)
    expect(isLarkEditExpiredError(undefined)).toBe(false)
  })
})
