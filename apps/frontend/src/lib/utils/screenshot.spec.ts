import { describe, expect, it } from 'vitest'
import { BUG_REPORT_SCREENSHOT_MAX_BYTES } from '@tabletop/common'
import { pastedImages, shrinkUntilFits } from './screenshot'

describe('pastedImages', () => {
    const png = new File(['png'], 'shot.png', { type: 'image/png' })
    const heic = new File(['heic'], 'photo.heic', { type: 'image/heic' })
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain' })

    it('keeps only the images among pasted files', () => {
        expect(pastedImages(['Files'], [png, text, heic])).toEqual([png, heic])
    })

    it('takes no image from a paste that carries text', () => {
        expect(pastedImages(['text/plain', 'text/html', 'Files'], [png])).toEqual([])
    })
})

describe('shrinkUntilFits', () => {
    function encoderBy(bytesAt: (scale: number, quality: number) => number) {
        const attempts: { scale: number; quality: number }[] = []
        const encodeAt = async (scale: number, quality: number) => {
            attempts.push({ scale, quality })
            return new Blob([new Uint8Array(bytesAt(scale, quality))])
        }
        return { attempts, encodeAt }
    }

    it('keeps the first encoding when it fits', async () => {
        const { attempts, encodeAt } = encoderBy(() => BUG_REPORT_SCREENSHOT_MAX_BYTES)

        const { blob, scale } = await shrinkUntilFits(encodeAt, 0.5)

        expect(blob.size).toBe(BUG_REPORT_SCREENSHOT_MAX_BYTES)
        expect(scale).toBe(0.5)
        expect(attempts).toHaveLength(1)
    })

    it('lowers the quality before it shrinks the image', async () => {
        const { attempts, encodeAt } = encoderBy((_scale, quality) =>
            quality < 0.8 ? BUG_REPORT_SCREENSHOT_MAX_BYTES : BUG_REPORT_SCREENSHOT_MAX_BYTES + 1
        )

        const { scale } = await shrinkUntilFits(encodeAt, 1)

        expect(scale).toBe(1)
        expect(attempts).toEqual([
            { scale: 1, quality: 0.85 },
            { scale: 1, quality: 0.7 }
        ])
    })

    it('scales the image down until the encoding fits', async () => {
        const { attempts, encodeAt } = encoderBy((scale) =>
            Math.round(BUG_REPORT_SCREENSHOT_MAX_BYTES * 2 * scale * scale)
        )

        const { blob, scale } = await shrinkUntilFits(encodeAt, 1)

        expect(blob.size).toBeLessThanOrEqual(BUG_REPORT_SCREENSHOT_MAX_BYTES)
        expect(scale).toBeLessThan(1)
        const scales = attempts.map((attempt) => attempt.scale)
        expect(scales).toEqual([...scales].sort((a, b) => b - a))
    })

    it('gives up on an image that never fits', async () => {
        const { encodeAt } = encoderBy(() => BUG_REPORT_SCREENSHOT_MAX_BYTES + 1)

        await expect(shrinkUntilFits(encodeAt, 1)).rejects.toThrow()
    })
})
