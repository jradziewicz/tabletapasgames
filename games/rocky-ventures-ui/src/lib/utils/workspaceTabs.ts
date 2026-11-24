export const PlayerAidTabId = 'playerAid'

// A layout saved before the Player Aid tab existed would get it last. Put it right after the map
// instead. Once a layout is saved with the tab, it stays wherever the player has it.
export function withPlayerAidTab(saved: unknown): unknown {
    if (!saved || typeof saved !== 'object' || !('main' in saved)) return saved
    const main = (saved as { main: unknown }).main
    if (JSON.stringify(main).includes(`"${PlayerAidTabId}"`)) return saved
    return { ...saved, main: insertAfterMap(main) }
}

function insertAfterMap(node: unknown): unknown {
    if (!Array.isArray(node)) return node
    if (node.length === 4 && (node[0] === 'rows' || node[0] === 'cols') && typeof node[1] === 'number') {
        return [node[0], node[1], insertAfterMap(node[2]), insertAfterMap(node[3])]
    }
    const at = node.indexOf('board')
    return at < 0 ? node : [...node.slice(0, at + 1), PlayerAidTabId, ...node.slice(at + 1)]
}
