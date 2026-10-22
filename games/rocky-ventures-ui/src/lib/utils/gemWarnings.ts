import {
    BonusGemMinimumWeaponLevel,
    BonusInvestMinimumWeaponLevel,
    GridBlockedVictoryPoints,
    MaxGems,
    MaxToolLevel,
    MaxWeaponLevel,
    WeaponTokenKind,
    canMoveUp,
    gemSupplyLeft,
    type HydratedRockyVenturesGameState
} from '@tabletop/rocky-ventures'

// Why a gem this player is about to earn would not actually be gained, if it wouldn't.
export function gemGainBlockedReason(state: HydratedRockyVenturesGameState, playerId: string): string | undefined {
    if (state.getPlayerState(playerId).gems >= MaxGems) {
        return `you already hold ${MaxGems} gems`
    }
    if (gemSupplyLeft(state) <= 0) {
        return 'there are no gems left in the supply'
    }
    return undefined
}

// Warnings for hunt bonus tokens the player has picked but will get nothing from. The token still
// goes on the dragon tracker either way.
export function huntBonusWarnings(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    tokens: WeaponTokenKind[]
): string[] {
    const weaponLevel = state.getPlayerState(playerId).weaponLevel
    const warnings: string[] = []
    if (tokens.includes(WeaponTokenKind.BonusGem)) {
        if (weaponLevel < BonusGemMinimumWeaponLevel) {
            warnings.push(`Bonus Gem gives nothing: it needs weapon level ${BonusGemMinimumWeaponLevel}`)
        } else {
            const blocked = gemGainBlockedReason(state, playerId)
            if (blocked) warnings.push(`Bonus Gem gives nothing: ${blocked}`)
        }
    }
    if (tokens.includes(WeaponTokenKind.BonusWeaponLevel)) {
        const player = state.getPlayerState(playerId)
        const cell = { weapon: player.weaponLevel, tool: player.toolLevel }
        if (!canMoveUp(cell)) {
            if (cell.weapon >= MaxWeaponLevel && cell.tool >= MaxToolLevel) {
                warnings.push(`Bonus Weapon Level can't move you up: you're at the top of the grid (+${GridBlockedVictoryPoints} VP instead)`)
            } else if (cell.weapon >= MaxWeaponLevel) {
                warnings.push('Bonus Weapon Level gives nothing: you are already at the top weapon level')
            } else {
                warnings.push('Bonus Weapon Level gives nothing: a wall on the grid blocks moving up')
            }
        }
    }
    if (tokens.includes(WeaponTokenKind.BonusInvest) && weaponLevel < BonusInvestMinimumWeaponLevel) {
        warnings.push(`Bonus Invest gives nothing: it needs weapon level ${BonusInvestMinimumWeaponLevel}`)
    }
    return warnings
}
