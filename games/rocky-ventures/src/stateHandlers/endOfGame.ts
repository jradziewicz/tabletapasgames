import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { DummyPlayerId } from '../model/dummy.js'
import { recordCash, recordVictoryPoints } from '../operations/stats.js'
import { determineWinners, finalScores } from '../operations/endGame.js'

export class EndOfGameStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        for (const score of finalScores(state).filter((entry) => entry.playerId !== DummyPlayerId)) {
            const player = state.getPlayerState(score.playerId)
            for (const share of player.shares) {
                const company = state.getCompany(share.companyId)
                recordCash(
                    state,
                    score.playerId,
                    company.multiplierForShare(share.shareIndex) * company.value,
                    'shareFinal',
                    { cardId: share.cardId }
                )
            }
            recordVictoryPoints(state, score.playerId, score.conversionVictoryPoints, 'finalCash', {
                cardId: undefined
            })
        }
        const { result, winningPlayerIds, dummyWins } = determineWinners(state)
        if (state.dummy && dummyWins) {
            state.dummy.won = true
        }
        state.result = result
        state.winningPlayerIds = winningPlayerIds
        state.activePlayerIds = []
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        throw Error('No actions are valid at the end of the game')
    }
}
