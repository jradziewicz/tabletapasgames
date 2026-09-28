// Tiny shared piece of ephemeral, per-viewer UI state: which closed Border level (if any)
// BorderClosedRevealOverlay.svelte currently has pinned on screen, so Board.svelte can pulse
// that same Border's own segments on the actual map behind/around the overlay - see each file's
// own comments for why. Nothing here is game state - it's not shared or persisted server-side,
// and it isn't on GameSession either, since it's purely a hand-off between two sibling
// components (both mounted once in GameTable.svelte) rather than anything tied to a submitted
// action, unlike GameSession's own signTheAgreementReveal/secretAgentsReveal.
export const borderClosedReveal: { level: number | undefined } = $state({ level: undefined })
