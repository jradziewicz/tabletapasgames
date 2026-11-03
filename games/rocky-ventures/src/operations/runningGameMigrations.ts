import { DeliveryCityId } from '../data/board.js'
import { isTwoSidedAgreement, TwoSidedAgreementLetters } from '../data/agreements.js'
import { MaxGems } from '../model/playerState.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'

// Running games Justin asked to move onto the two-sided agreements and the 2-gem start
// (2026-11-03). Each switches the first time it loads after the change, as long as nobody holds
// an agreement yet; the switched state is saved with the next action.
export const TwoSidedAgreementGameIds: string[] = [
    'Vfz4QAGhl4cfVpTXYAxw8' // Eye of the Tiger
]

export function migrateRunningGame(state: HydratedRockyVenturesGameState) {
    if (!TwoSidedAgreementGameIds.includes(state.gameId)) {
        return
    }
    const cities = [DeliveryCityId.Dornoch, DeliveryCityId.Manor]
    const stillOriginal = cities.every((cityId) =>
        (state.agreementStacks[cityId] ?? []).every((letter) => !isTwoSidedAgreement(letter))
    )
    if (!stillOriginal || state.players.some((player) => player.agreements.length > 0)) {
        return
    }
    for (const cityId of cities) {
        state.agreementStacks[cityId] = [...TwoSidedAgreementLetters]
    }
    for (const player of state.players) {
        player.gems = Math.min(MaxGems, player.gems + 1)
    }
}
