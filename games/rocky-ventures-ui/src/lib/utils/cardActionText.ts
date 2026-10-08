import { AcquireMode, CardActionKind, CardKind, getCard, type CardAction } from '@tabletop/rocky-ventures'

function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

// One line of plain text per printed action, e.g. "Lay Track: up to 3 track for up to 2 railroads".
export function cardActionText(action: CardAction): string {
    switch (action.kind) {
        case CardActionKind.Invest:
            return 'Invest: buy a card from the market'
        case CardActionKind.Tax:
            return 'Tax: $1 for each coin visible to the left'
        case CardActionKind.ClaimMine: {
            const extras = [
                action.regionalHunts ? `then ${plural(action.regionalHunts, 'regional hunt')}` : undefined,
                action.levelTwoMinesFree ? 'level 2 mines are free' : undefined
            ].filter(Boolean)
            return `Claim Mine: ${plural(action.mines, 'mine')}${extras.length ? ` (${extras.join(', ')})` : ''}`
        }
        case CardActionKind.LayTrack:
            return `Lay Track: up to ${action.maxTracks} track for up to ${plural(action.maxCompanies, 'railroad')}`
        case CardActionKind.ExtractAndSell: {
            const extras = [
                action.bonusOre ? `+${action.bonusOre} ore` : undefined,
                action.temporaryToolLevels ? `+${action.temporaryToolLevels} tool level` : undefined,
                action.disregardScourges ? `ignore ${plural(action.disregardScourges, 'scourge')}` : undefined,
                action.addsScourge ? 'adds a scourge' : undefined
            ].filter(Boolean)
            return `Extract & Sell${extras.length ? `: ${extras.join(', ')}` : ''}`
        }
        case CardActionKind.Acquire:
            return action.mode === AcquireMode.OneToolAndOneWeapon
                ? 'Acquire: 1 tool and 1 weapon level'
                : `Acquire: ${plural(action.levels, 'tool or weapon level')}`
        case CardActionKind.Hunt:
            return `Hunt: ${plural(action.hunts, 'hunt')}`
    }
}

// Hover text for a card in a player's tableau: its name and every action on it.
export function cardActionsTooltip(cardId: string): string {
    const card = getCard(cardId)
    if (card.kind === CardKind.EndOfEra) return `End of Era ${card.era}`
    if (card.kind === CardKind.GameOver) return 'Game Over'
    const title = card.kind === CardKind.Player ? `Card ${card.numeral}` : `Card ${card.number}`
    const joiner = card.kind === CardKind.Player && card.exclusiveActions ? '\nor ' : '\n'
    return `${title}\n${card.actions.map(cardActionText).join(joiner)}`
}
