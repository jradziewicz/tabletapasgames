import type { StellarVenturesGameSession } from './session.svelte.js'

// "Already watched" for the reveal overlays (Pay Taxes, Border Closed, First Ship Ordered, Sign
// The Agreement) used to live only in this browser's localStorage, so an overlay watched on a
// phone played again on a desktop. Each overlay's own seen value (the same string it always
// stored) is now also saved to the player's account via the seenOverlays title preference, and
// read from there first. localStorage stays as a backup for when preferences can't load.
// Overlays should wait for `ready` before showing, or a desktop would play one before the
// account copy arrives.

// Oldest entries are dropped past this many (each game adds a handful of keys).
const MAX_ENTRIES = 300

export class SeenOverlays {
    constructor(private readonly session: StellarVenturesGameSession) {}

    get ready(): boolean {
        return this.session.preferences.ready
    }

    get(key: string): string | undefined {
        const stored = this.session.preferences.values.seenOverlays?.[key]
        if (stored !== undefined) return stored
        try {
            return localStorage.getItem(key) ?? undefined
        } catch {
            return undefined
        }
    }

    set(key: string, value: string) {
        try {
            localStorage.setItem(key, value)
        } catch {
            // Best-effort - the account copy below is the one that matters.
        }
        const current = this.session.preferences.values.seenOverlays ?? {}
        if (current[key] === value) return
        const next = { ...current }
        delete next[key]
        next[key] = value
        const keys = Object.keys(next)
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete next[old]
        void this.session.preferences.save({ seenOverlays: next })
    }
}
