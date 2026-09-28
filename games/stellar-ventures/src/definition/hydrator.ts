import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPassAuction, isPassAuction } from '../actions/passAuction.js'
import { HydratedIssueShare, isIssueShare } from '../actions/issueShare.js'
import { HydratedDeclineIssueShare, isDeclineIssueShare } from '../actions/declineIssueShare.js'
import { HydratedPlaceShareBid, isPlaceShareBid } from '../actions/placeShareBid.js'
import { HydratedPassShareBid, isPassShareBid } from '../actions/passShareBid.js'
import { HydratedExpandNetwork, isExpandNetwork } from '../actions/expandNetwork.js'
import { HydratedCreateWormhole, isCreateWormhole } from '../actions/createWormhole.js'
import {
    HydratedDeclineExpandNetworkOrWormhole,
    isDeclineExpandNetworkOrWormhole
} from '../actions/declineExpandNetworkOrWormhole.js'
import { HydratedPayDividends, isPayDividends } from '../actions/payDividends.js'
import { HydratedOrderShip, isOrderShip } from '../actions/orderShip.js'
import { HydratedForcedShipPurchase, isForcedShipPurchaseAction } from '../actions/forcedShipPurchase.js'
import { HydratedDeclineOrderShips, isDeclineOrderShips } from '../actions/declineOrderShips.js'
import { HydratedReleaseDividends, isReleaseDividends } from '../actions/releaseDividends.js'
import { HydratedPlaceBoardroomVote, isPlaceBoardroomVote } from '../actions/placeBoardroomVote.js'
import {
    HydratedDeclineBoardroomVote,
    isDeclineBoardroomVote
} from '../actions/declineBoardroomVote.js'
import {
    HydratedChooseBoardroomBattleCorporation,
    isChooseBoardroomBattleCorporation
} from '../actions/chooseBoardroomBattleCorporation.js'
import { HydratedBlackMarket, isBlackMarket } from '../actions/blackMarket.js'
import { HydratedPassInvestorAction, isPassInvestorAction } from '../actions/passInvestorAction.js'
import { HydratedLaunder, isLaunder } from '../actions/launder.js'
import {
    HydratedPassAlienTechAction,
    isPassAlienTechAction
} from '../actions/passAlienTechAction.js'
import { HydratedJerryRig, isJerryRig } from '../actions/jerryRig.js'
import { HydratedPrivateContractor, isPrivateContractor } from '../actions/privateContractor.js'
import { HydratedInsuranceFraud, isInsuranceFraud } from '../actions/insuranceFraud.js'
import { HydratedCargoBoost, isCargoBoost } from '../actions/cargoBoost.js'
import { HydratedResearchWormhole, isResearchWormhole } from '../actions/researchWormhole.js'
import { HydratedDevelopPlanets, isDevelopPlanets } from '../actions/developPlanets.js'
import { HydratedScrapLowestShip, isScrapLowestShip } from '../actions/scrapLowestShip.js'
import { HydratedDeliverShips, isDeliverShips } from '../actions/deliverShips.js'
import { HydratedAssignTurnOrder, isAssignTurnOrder } from '../actions/assignTurnOrder.js'
import {
    HydratedChooseAmethystHomePlanet,
    isChooseAmethystHomePlanet
} from '../actions/chooseAmethystHomePlanet.js'
import { HydratedSignTheAgreement, isSignTheAgreement } from '../actions/signTheAgreement.js'
import {
    HydratedDeclineSignTheAgreement,
    isDeclineSignTheAgreement
} from '../actions/declineSignTheAgreement.js'
import {
    HydratedIncreaseAlienMiningCapacity,
    isIncreaseAlienMiningCapacity
} from '../actions/increaseAlienMiningCapacity.js'
import {
    HydratedIncreaseAmethystMiningCapacity,
    isIncreaseAmethystMiningCapacity
} from '../actions/increaseAmethystMiningCapacity.js'
import { HydratedFinishExpansion, isFinishExpansion } from '../actions/finishExpansion.js'
import { HydratedLiquidate, isLiquidate } from '../actions/liquidate.js'
import { HydratedDraftPower, isDraftPower } from '../actions/draftPower.js'
import { HydratedAlienAlchemist, isAlienAlchemist } from '../actions/alienAlchemist.js'
import { HydratedLeakedResearch, isLeakedResearch } from '../actions/leakedResearch.js'
import {
    HydratedDismantlingOutposts,
    isDismantlingOutposts
} from '../actions/dismantlingOutposts.js'
import { HydratedNebularExplorers, isNebularExplorers } from '../actions/nebularExplorers.js'
import { HydratedBackroomDeal, isBackroomDeal } from '../actions/backroomDeal.js'
import {
    HydratedDeclineBackroomDeal,
    isDeclineBackroomDeal
} from '../actions/declineBackroomDeal.js'
import { HydratedFinePrint, isFinePrint } from '../actions/finePrint.js'
import { HydratedDeclineFinePrint, isDeclineFinePrint } from '../actions/declineFinePrint.js'
import { HydratedDeepSpaceSmuggling, isDeepSpaceSmuggling } from '../actions/deepSpaceSmuggling.js'
import { HydratedDeepSpacePirates, isDeepSpacePirates } from '../actions/deepSpacePirates.js'
import {
    HydratedDeclinePayDividendsPower,
    isDeclinePayDividendsPower
} from '../actions/declinePayDividendsPower.js'
import { HydratedAlienEngineering, isAlienEngineering } from '../actions/alienEngineering.js'
import { HydratedSpareParts, isSpareParts } from '../actions/spareParts.js'
import { HydratedDeclineSpareParts, isDeclineSpareParts } from '../actions/declineSpareParts.js'
import { HydratedPayTax, isPayTax } from '../actions/payTax.js'
import { HydratedTaxAgentsForceTax, isTaxAgentsForceTax } from '../actions/taxAgentsForceTax.js'
import {
    HydratedTaxAgentsTakeFromTaxBox,
    isTaxAgentsTakeFromTaxBox
} from '../actions/taxAgentsTakeFromTaxBox.js'
import { HydratedStellarVenturesGameState, StellarVenturesGameState } from '../model/gameState.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for Stellar Ventures. Used by the game engine
export class StellarVenturesHydrator implements GameHydrator<
    StellarVenturesGameState,
    HydratedStellarVenturesGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data): {
                return new HydratedPlaceBid(data)
            }
            case isPassAuction(data): {
                return new HydratedPassAuction(data)
            }
            case isIssueShare(data): {
                return new HydratedIssueShare(data)
            }
            case isDeclineIssueShare(data): {
                return new HydratedDeclineIssueShare(data)
            }
            case isPlaceShareBid(data): {
                return new HydratedPlaceShareBid(data)
            }
            case isPassShareBid(data): {
                return new HydratedPassShareBid(data)
            }
            case isExpandNetwork(data): {
                return new HydratedExpandNetwork(data)
            }
            case isCreateWormhole(data): {
                return new HydratedCreateWormhole(data)
            }
            case isDeclineExpandNetworkOrWormhole(data): {
                return new HydratedDeclineExpandNetworkOrWormhole(data)
            }
            case isPayDividends(data): {
                return new HydratedPayDividends(data)
            }
            case isOrderShip(data): {
                return new HydratedOrderShip(data)
            }
            case isForcedShipPurchaseAction(data): {
                return new HydratedForcedShipPurchase(data)
            }
            case isDeclineOrderShips(data): {
                return new HydratedDeclineOrderShips(data)
            }
            case isReleaseDividends(data): {
                return new HydratedReleaseDividends(data)
            }
            case isPlaceBoardroomVote(data): {
                return new HydratedPlaceBoardroomVote(data)
            }
            case isDeclineBoardroomVote(data): {
                return new HydratedDeclineBoardroomVote(data)
            }
            case isChooseBoardroomBattleCorporation(data): {
                return new HydratedChooseBoardroomBattleCorporation(data)
            }
            case isBlackMarket(data): {
                return new HydratedBlackMarket(data)
            }
            case isPassInvestorAction(data): {
                return new HydratedPassInvestorAction(data)
            }
            case isLaunder(data): {
                return new HydratedLaunder(data)
            }
            case isPassAlienTechAction(data): {
                return new HydratedPassAlienTechAction(data)
            }
            case isJerryRig(data): {
                return new HydratedJerryRig(data)
            }
            case isPrivateContractor(data): {
                return new HydratedPrivateContractor(data)
            }
            case isInsuranceFraud(data): {
                return new HydratedInsuranceFraud(data)
            }
            case isCargoBoost(data): {
                return new HydratedCargoBoost(data)
            }
            case isResearchWormhole(data): {
                return new HydratedResearchWormhole(data)
            }
            case isDevelopPlanets(data): {
                return new HydratedDevelopPlanets(data)
            }
            case isScrapLowestShip(data): {
                return new HydratedScrapLowestShip(data)
            }
            case isDeliverShips(data): {
                return new HydratedDeliverShips(data)
            }
            case isAssignTurnOrder(data): {
                return new HydratedAssignTurnOrder(data)
            }
            case isChooseAmethystHomePlanet(data): {
                return new HydratedChooseAmethystHomePlanet(data)
            }
            case isSignTheAgreement(data): {
                return new HydratedSignTheAgreement(data)
            }
            case isDeclineSignTheAgreement(data): {
                return new HydratedDeclineSignTheAgreement(data)
            }
            case isIncreaseAlienMiningCapacity(data): {
                return new HydratedIncreaseAlienMiningCapacity(data)
            }
            case isIncreaseAmethystMiningCapacity(data): {
                return new HydratedIncreaseAmethystMiningCapacity(data)
            }
            case isFinishExpansion(data): {
                return new HydratedFinishExpansion(data)
            }
            case isLiquidate(data): {
                return new HydratedLiquidate(data)
            }
            case isDraftPower(data): {
                return new HydratedDraftPower(data)
            }
            case isAlienAlchemist(data): {
                return new HydratedAlienAlchemist(data)
            }
            case isLeakedResearch(data): {
                return new HydratedLeakedResearch(data)
            }
            case isDismantlingOutposts(data): {
                return new HydratedDismantlingOutposts(data)
            }
            case isNebularExplorers(data): {
                return new HydratedNebularExplorers(data)
            }
            case isBackroomDeal(data): {
                return new HydratedBackroomDeal(data)
            }
            case isDeclineBackroomDeal(data): {
                return new HydratedDeclineBackroomDeal(data)
            }
            case isFinePrint(data): {
                return new HydratedFinePrint(data)
            }
            case isDeclineFinePrint(data): {
                return new HydratedDeclineFinePrint(data)
            }
            case isDeepSpaceSmuggling(data): {
                return new HydratedDeepSpaceSmuggling(data)
            }
            case isDeepSpacePirates(data): {
                return new HydratedDeepSpacePirates(data)
            }
            case isDeclinePayDividendsPower(data): {
                return new HydratedDeclinePayDividendsPower(data)
            }
            case isAlienEngineering(data): {
                return new HydratedAlienEngineering(data)
            }
            case isSpareParts(data): {
                return new HydratedSpareParts(data)
            }
            case isDeclineSpareParts(data): {
                return new HydratedDeclineSpareParts(data)
            }
            case isPayTax(data): {
                return new HydratedPayTax(data)
            }
            case isTaxAgentsForceTax(data): {
                return new HydratedTaxAgentsForceTax(data)
            }
            case isTaxAgentsTakeFromTaxBox(data): {
                return new HydratedTaxAgentsTakeFromTaxBox(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: StellarVenturesGameState): HydratedStellarVenturesGameState {
        return new HydratedStellarVenturesGameState(state)
    }
}
