import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedRockyVenturesGameState, RockyVenturesGameState } from '../model/gameState.js'
import { HydratedMovePawn, isMovePawn } from '../actions/movePawn.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedInvest, isInvest } from '../actions/invest.js'
import { HydratedChooseShare, isChooseShare } from '../actions/chooseShare.js'
import { HydratedPointBuy, isPointBuy } from '../actions/pointBuy.js'
import { HydratedClaimMine, isClaimMine } from '../actions/claimMine.js'
import { HydratedLayTrack, isLayTrack } from '../actions/layTrack.js'
import { HydratedExtractAndSell, isExtractAndSell } from '../actions/extractAndSell.js'
import { HydratedHunt, isHunt } from '../actions/hunt.js'
import { HydratedAcquire, isAcquire } from '../actions/acquire.js'
import { HydratedGemAction, isGemAction } from '../actions/gemAction.js'
import { HydratedAgreementPointBuy, isAgreementPointBuy } from '../actions/agreementPointBuy.js'
import { HydratedDiscardAgreement, isDiscardAgreement } from '../actions/discardAgreement.js'
import { HydratedLayFreeTrack, isLayFreeTrack } from '../actions/layFreeTrack.js'
import { HydratedSellVictoryPoints, isSellVictoryPoints } from '../actions/sellVictoryPoints.js'
import { HydratedResolveHunt, isResolveHunt } from '../actions/resolveHunt.js'
import { HydratedSkipBonusInvest, isSkipBonusInvest } from '../actions/skipBonusInvest.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'

export class RockyVenturesHydrator
    implements GameHydrator<RockyVenturesGameState, HydratedRockyVenturesGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isMovePawn(data):
                return new HydratedMovePawn(data)
            case isTax(data):
                return new HydratedTax(data)
            case isInvest(data):
                return new HydratedInvest(data)
            case isChooseShare(data):
                return new HydratedChooseShare(data)
            case isPointBuy(data):
                return new HydratedPointBuy(data)
            case isClaimMine(data):
                return new HydratedClaimMine(data)
            case isLayTrack(data):
                return new HydratedLayTrack(data)
            case isExtractAndSell(data):
                return new HydratedExtractAndSell(data)
            case isHunt(data):
                return new HydratedHunt(data)
            case isAcquire(data):
                return new HydratedAcquire(data)
            case isGemAction(data):
                return new HydratedGemAction(data)
            case isAgreementPointBuy(data):
                return new HydratedAgreementPointBuy(data)
            case isDiscardAgreement(data):
                return new HydratedDiscardAgreement(data)
            case isLayFreeTrack(data):
                return new HydratedLayFreeTrack(data)
            case isSellVictoryPoints(data):
                return new HydratedSellVictoryPoints(data)
            case isResolveHunt(data):
                return new HydratedResolveHunt(data)
            case isSkipBonusInvest(data):
                return new HydratedSkipBonusInvest(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: RockyVenturesGameState): HydratedRockyVenturesGameState {
        return new HydratedRockyVenturesGameState(state)
    }
}
