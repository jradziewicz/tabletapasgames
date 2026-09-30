import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { MovePawnStateHandler } from '../stateHandlers/movePawn.js'
import { TakeActionsStateHandler } from '../stateHandlers/takeActions.js'
import { ChooseShareStateHandler } from '../stateHandlers/chooseShare.js'
import { PointBuyStateHandler } from '../stateHandlers/pointBuy.js'
import { AgreementPointBuyStateHandler } from '../stateHandlers/agreementPointBuy.js'
import { FreeTrackStateHandler } from '../stateHandlers/freeTrack.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { BonusInvestStateHandler, HuntStateHandler } from '../stateHandlers/hunt.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'

export const RockyVenturesStateHandlers: Record<
    string,
    MachineStateHandler<HydratedAction, HydratedRockyVenturesGameState>
> = {
    [MachineState.MovePawn]: new MovePawnStateHandler(),
    [MachineState.TakeActions]: new TakeActionsStateHandler(),
    [MachineState.ChooseShare]: new ChooseShareStateHandler(),
    [MachineState.PointBuy]: new PointBuyStateHandler(),
    [MachineState.Hunt]: new HuntStateHandler(),
    [MachineState.AgreementPointBuy]: new AgreementPointBuyStateHandler(),
    [MachineState.FreeTrack]: new FreeTrackStateHandler(),
    [MachineState.BonusInvest]: new BonusInvestStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
