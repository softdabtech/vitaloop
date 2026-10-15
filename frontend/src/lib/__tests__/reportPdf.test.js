import { describe, expect, it, vi } from 'vitest'
import { embedReportFonts } from '../reportPdf.js'

describe('report PDF font embedding', () => {
  it('embeds regular and bold Noto Sans fonts for Unicode units and status labels', async () => {
    const pdf = {
      addFileToVFS: vi.fn(),
      addFont: vi.fn(),
    }
    const fetchFont = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0, 1, 2, 255]).buffer,
    }))

    await embedReportFonts(pdf, fetchFont)

    expect(fetchFont).toHaveBeenCalledWith('/fonts/NotoSans-Regular.ttf')
    expect(fetchFont).toHaveBeenCalledWith('/fonts/NotoSans-Bold.ttf')
    expect(pdf.addFileToVFS).toHaveBeenCalledTimes(2)
    expect(pdf.addFont).toHaveBeenNthCalledWith(1, 'NotoSans-Regular.ttf', 'NotoSans', 'normal')
    expect(pdf.addFont).toHaveBeenNthCalledWith(2, 'NotoSans-Bold.ttf', 'NotoSans', 'bold')
  })

  it('surfaces a missing font rather than silently falling back to a corrupt glyph font', async () => {
    await expect(embedReportFonts(
      { addFileToVFS: vi.fn(), addFont: vi.fn() },
      async () => ({ ok: false, status: 404 }),
    )).rejects.toThrow('Failed to load report font: NotoSans-Regular.ttf (404)')
  })
})
