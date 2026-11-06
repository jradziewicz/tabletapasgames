import { CardActionKind, CardKind, getCard } from '@tabletop/rocky-ventures'

// The action icon colours on the printed cards and player mat.
const ActionColors: Partial<Record<CardActionKind, string>> = {
    [CardActionKind.ClaimMine]: '#b5929a',
    [CardActionKind.LayTrack]: '#a597cc',
    [CardActionKind.ExtractAndSell]: '#d6c65c',
    [CardActionKind.Hunt]: '#e07068',
    [CardActionKind.Acquire]: '#7fb898',
    [CardActionKind.Invest]: '#a4a6ad',
    [CardActionKind.Tax]: '#a9d3e6'
}

function actionKinds(cardId: string): CardActionKind[] {
    const card = getCard(cardId)
    return card.kind === CardKind.Player || card.kind === CardKind.Development
        ? card.actions.map((action) => action.kind)
        : []
}

// A card's chip background: its action colour, split evenly when it has more than one. A stack
// counts the top action of the card underneath first.
export function cardChipBackground(cardId: string, underCardId?: string): string {
    const kinds = [...(underCardId ? actionKinds(underCardId).slice(0, 1) : []), ...actionKinds(cardId)]
    const colors = [...new Set(kinds.map((kind) => ActionColors[kind] ?? '#f3ead6'))]
    if (colors.length <= 1) {
        return colors[0] ?? '#f3ead6'
    }
    const share = 100 / colors.length
    const stops = colors.map((color, index) => `${color} ${index * share}% ${(index + 1) * share}%`)
    return `linear-gradient(90deg, ${stops.join(', ')})`
}
