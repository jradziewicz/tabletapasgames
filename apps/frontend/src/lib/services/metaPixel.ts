/**
 * Meta (Facebook) Pixel integration.
 *
 * Loads the pixel on demand and exposes a tiny tracking API. Every call is a
 * no-op until `initMetaPixel` has been given a pixel id, so the rest of the app
 * can call `trackMetaEvent` unconditionally (tests, local dev and builds
 * without PUBLIC_META_PIXEL_ID set simply track nothing).
 *
 * The app is an SPA, so PageView is sent from the root layout on every client
 * side navigation rather than only on the initial load.
 */

type FbqArgs = unknown[]
type Fbq = ((...args: FbqArgs) => void) & { queue?: FbqArgs[]; loaded?: boolean; version?: string }

declare global {
    interface Window {
        fbq?: Fbq
        _fbq?: Fbq
    }
}

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js'

let pixelId: string | undefined
let enabled = false

/** Hosts where the pixel should never load (local development and previews). */
function isBlockedHost(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.a.run.app')
    )
}

function ensureFbq(): Fbq | undefined {
    if (typeof window === 'undefined') {
        return undefined
    }
    if (window.fbq) {
        return window.fbq
    }

    // Equivalent of Meta's official bootstrap snippet, without the inline script.
    const fbq: Fbq = function (...args: FbqArgs) {
        fbq.queue?.push(args)
    }
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = SCRIPT_SRC
    document.head.appendChild(script)

    return fbq
}

/**
 * Initialise the pixel. Safe to call more than once; only the first call with
 * a non-empty id does anything.
 */
export function initMetaPixel(id: string | undefined): void {
    if (enabled || !id || typeof window === 'undefined') {
        return
    }
    if (isBlockedHost(window.location.hostname)) {
        return
    }

    const fbq = ensureFbq()
    if (!fbq) {
        return
    }

    pixelId = id
    enabled = true
    fbq('init', pixelId)
}

export function isMetaPixelEnabled(): boolean {
    return enabled
}

function uniqueEventId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function trackMetaPageView(): void {
    if (!enabled || !window.fbq) {
        return
    }
    window.fbq('track', 'PageView', {}, { eventID: uniqueEventId() })
}

/** Standard Meta events we use. Anything else is sent as a custom event. */
const STANDARD_EVENTS = new Set([
    'CompleteRegistration',
    'Lead',
    'ViewContent',
    'Search',
    'Contact',
    'SubmitApplication'
])

/**
 * Track an event. Standard Meta event names go through `track`; everything
 * else (e.g. `GameCreated`) goes through `trackCustom`.
 */
export function trackMetaEvent(name: string, params: Record<string, unknown> = {}): void {
    if (!enabled || !window.fbq) {
        return
    }
    const method = STANDARD_EVENTS.has(name) ? 'track' : 'trackCustom'
    window.fbq(method, name, params, { eventID: uniqueEventId() })
}
