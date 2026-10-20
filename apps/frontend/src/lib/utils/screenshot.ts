import {
    BUG_REPORT_SCREENSHOT_MAX_BYTES,
    BUG_REPORT_SCREENSHOT_MAX_EDGE_PX,
    type BugReportScreenshot
} from '@tabletop/common'

const START_EDGE_PX = 1920
const JPEG_QUALITIES = [0.85, 0.7, 0.55] as const
const SHRINK_STEP = 0.8
const MAX_SHRINKS = 12
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,'

export type Screenshot = {
    upload: BugReportScreenshot
    previewUrl: string
}

// Office apps put a picture of copied text on the clipboard beside the text itself.
export function pastedImages(types: readonly string[], files: Iterable<File>): File[] {
    if (types.includes('text/plain')) {
        return []
    }
    return [...files].filter((file) => file.type.startsWith('image/'))
}

export async function screenshotFromImage(file: File): Promise<Screenshot> {
    const bitmap = await createImageBitmap(file)
    try {
        const startScale = Math.min(1, START_EDGE_PX / Math.max(bitmap.width, bitmap.height))
        const { blob, scale } = await shrinkUntilFits(
            (scale, quality) => encodeJpeg(bitmap, scale, quality),
            startScale
        )
        const { width, height } = scaledSize(bitmap, scale)
        return {
            upload: { jpeg: await base64Of(blob), width, height },
            previewUrl: URL.createObjectURL(blob)
        }
    } finally {
        bitmap.close()
    }
}

export function releaseScreenshot(screenshot: Screenshot) {
    URL.revokeObjectURL(screenshot.previewUrl)
}

/**
 * Encodes at lower JPEG quality first, then at smaller sizes, until the result fits the
 * per-screenshot limit the server enforces.
 */
export async function shrinkUntilFits(
    encodeAt: (scale: number, quality: number) => Promise<Blob>,
    startScale: number
): Promise<{ blob: Blob; scale: number }> {
    let scale = startScale
    for (let shrinks = 0; shrinks <= MAX_SHRINKS; shrinks++) {
        for (const quality of JPEG_QUALITIES) {
            const blob = await encodeAt(scale, quality)
            if (blob.size <= BUG_REPORT_SCREENSHOT_MAX_BYTES) {
                return { blob, scale }
            }
        }
        scale *= SHRINK_STEP
    }
    throw new Error('Could not make the screenshot small enough')
}

function scaledSize(bitmap: ImageBitmap, scale: number): { width: number; height: number } {
    const clamp = (px: number) =>
        Math.min(BUG_REPORT_SCREENSHOT_MAX_EDGE_PX, Math.max(1, Math.round(px * scale)))
    return { width: clamp(bitmap.width), height: clamp(bitmap.height) }
}

// JPEG has no transparency, so a transparent pixel would otherwise turn black.
async function encodeJpeg(bitmap: ImageBitmap, scale: number, quality: number): Promise<Blob> {
    const { width, height } = scaledSize(bitmap, scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('Canvas 2D is unavailable')
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the screenshot'))),
            'image/jpeg',
            quality
        )
    )
}

async function base64Of(jpeg: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
            typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('Expected a data URL'))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(jpeg)
    })
    if (!dataUrl.startsWith(JPEG_DATA_URL_PREFIX)) {
        throw new Error('Expected a JPEG data URL')
    }
    return dataUrl.slice(JPEG_DATA_URL_PREFIX.length)
}
