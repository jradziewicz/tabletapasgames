import {
    BonusGemMinimumWeaponLevel,
    BonusInvestMinimumWeaponLevel,
    MaxGems,
    WeaponTokenKind,
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
    if (tokens.includes(WeaponTokenKind.BonusInvest) && weaponLevel < BonusInvestMinimumWeaponLevel) {
        warnings.push(`Bonus Invest gives nothing: it needs weapon level ${BonusInvestMinimumWeaponLevel}`)
    }
    return warnings
}
