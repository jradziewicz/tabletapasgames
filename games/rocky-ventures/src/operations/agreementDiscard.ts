import { AgreementDiscardFreeTracks, type AgreementLetter } from '../data/agreements.js'
import type { DeliveryCityId } from '../data/board.js'
import type { CompanyId } from '../data/companies.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { StatKind } from '../model/stats.js'
import { recordStat } from './stats.js'
import { buildableBoxes } from './track.js'

export function reasonDiscardAgreementInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId,
    letter: AgreementLetter,
    companyId: CompanyId
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    if (
        state.machineState !== MachineState.MovePawn &&
        state.machineState !== MachineState.TakeActions
    ) {
        return 'Agreements cannot be discarded right now'
    }
    const holds = state
        .getPlayerState(playerId)
        .agreements.some((agreement) => agreement.cityId === cityId && agreement.letter === letter)
    if (!holds) {
        return 'You do not hold that agreement'
    }
    if (buildableBoxes(state, companyId, true).length === 0) {
        return 'That railroad has nowhere to build'
    }
    return undefined
}

export function discardAgreement(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    cityId: DeliveryCityId,
    letter: AgreementLetter,
    companyId: CompanyId
) {
    const player = state.getPlayerState(playerId)
    const index = player.agreements.findIndex(
        (agreement) => agreement.cityId === cityId && agreement.letter === letter
    )
    player.agreements.splice(index, 1)
    const agreement = `${cityId}-${letter}`
    recordStat(state, {
        kind: StatKind.Action,
        playerId,
        amount: 1,
        source: 'DiscardAgreement',
        agreement
    })
    state.freeTrack = {
        companyId,
        remaining: AgreementDiscardFreeTracks,
        agreement,
        resumeState: state.machineState
    }
}
