import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isResolveHunt } from '../actions/resolveHunt.js'
import { isInvest, HydratedInvest } from '../actions/invest.js'
import { HydratedSellVictoryPoints, isSellVictoryPoints } from '../actions/sellVictoryPoints.js'
import { isSkipBonusInvest } from '../actions/skipBonusInvest.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { currentPlayerId } from '../operations/turn.js'
import { nextStateSkippingDeadTurns } from './playable.js'

export class HuntStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isResolveHunt(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        return context.gameState.activePlayerIds.includes(playerId) ? [ActionType.ResolveHunt] : []
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = [currentPlayerId(state)]
    }

    onAction(
        _action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        return nextStateSkippingDeadTurns(context.gameState)
    }
}

export class BonusInvestStateHandler
    implements MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRockyVenturesGameState>
    ): boolean {
        return isInvest(action) || isSkipBonusInvest(action) || isSellVictoryPoints(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string[] {
        const state = context.gameState
        if (!state.activePlayerIds.includes(playerId)) {
            return []
        }
        const valid: string[] = [ActionType.SkipBonusInvest]
        if (HydratedInvest.canInvest(state, playerId)) {
            valid.push(ActionType.Invest)
        }
        if (HydratedSellVictoryPoints.canSellVictoryPoints(state, playerId)) {
            valid.push(ActionType.SellVictoryPoints)
        }
        return valid
    }

    enter(context: MachineContext<HydratedRockyVenturesGameState>) {
        const state = context.gameState
        state.activePlayerIds = [currentPlayerId(state)]
    }

    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedRockyVenturesGameState>
    ): string {
        if (isSellVictoryPoints(action)) {
            return MachineState.BonusInvest
        }
        return nextStateSkippingDeadTurns(context.gameState)
    }
}
