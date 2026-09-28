import { PlaceBid } from '../actions/placeBid.js'
import { PassAuction } from '../actions/passAuction.js'
import { IssueShare } from '../actions/issueShare.js'
import { DeclineIssueShare } from '../actions/declineIssueShare.js'
import { PlaceShareBid } from '../actions/placeShareBid.js'
import { PassShareBid } from '../actions/passShareBid.js'
import { ExpandNetwork } from '../actions/expandNetwork.js'
import { CreateWormhole } from '../actions/createWormhole.js'
import { DeclineExpandNetworkOrWormhole } from '../actions/declineExpandNetworkOrWormhole.js'
import { PayDividends } from '../actions/payDividends.js'
import { OrderShip } from '../actions/orderShip.js'
import { ForcedShipPurchase } from '../actions/forcedShipPurchase.js'
import { DeclineOrderShips } from '../actions/declineOrderShips.js'
import { ReleaseDividends } from '../actions/releaseDividends.js'
import { PlaceBoardroomVote } from '../actions/placeBoardroomVote.js'
import { DeclineBoardroomVote } from '../actions/declineBoardroomVote.js'
import { ChooseBoardroomBattleCorporation } from '../actions/chooseBoardroomBattleCorporation.js'
import { BlackMarket } from '../actions/blackMarket.js'
import { PassInvestorAction } from '../actions/passInvestorAction.js'
import { Launder } from '../actions/launder.js'
import { PassAlienTechAction } from '../actions/passAlienTechAction.js'
import { JerryRig } from '../actions/jerryRig.js'
import { PrivateContractor } from '../actions/privateContractor.js'
import { InsuranceFraud } from '../actions/insuranceFraud.js'
import { CargoBoost } from '../actions/cargoBoost.js'
import { ResearchWormhole } from '../actions/researchWormhole.js'
import { DevelopPlanets } from '../actions/developPlanets.js'
import { ScrapLowestShip } from '../actions/scrapLowestShip.js'
import { DeliverShips } from '../actions/deliverShips.js'
import { AssignTurnOrder } from '../actions/assignTurnOrder.js'
import { ChooseAmethystHomePlanet } from '../actions/chooseAmethystHomePlanet.js'
import { SignTheAgreement } from '../actions/signTheAgreement.js'
import { DeclineSignTheAgreement } from '../actions/declineSignTheAgreement.js'
import { IncreaseAlienMiningCapacity } from '../actions/increaseAlienMiningCapacity.js'
import { IncreaseAmethystMiningCapacity } from '../actions/increaseAmethystMiningCapacity.js'
import { FinishExpansion } from '../actions/finishExpansion.js'
import { Liquidate } from '../actions/liquidate.js'
import { DraftPower } from '../actions/draftPower.js'
import { AlienAlchemist } from '../actions/alienAlchemist.js'
import { LeakedResearch } from '../actions/leakedResearch.js'
import { DismantlingOutposts } from '../actions/dismantlingOutposts.js'
import { NebularExplorers } from '../actions/nebularExplorers.js'
import { FinePrint } from '../actions/finePrint.js'
import { DeclineFinePrint } from '../actions/declineFinePrint.js'
import { BackroomDeal } from '../actions/backroomDeal.js'
import { DeclineBackroomDeal } from '../actions/declineBackroomDeal.js'
import { DeepSpaceSmuggling } from '../actions/deepSpaceSmuggling.js'
import { DeepSpacePirates } from '../actions/deepSpacePirates.js'
import { DeclinePayDividendsPower } from '../actions/declinePayDividendsPower.js'
import { AlienEngineering } from '../actions/alienEngineering.js'
import { SpareParts } from '../actions/spareParts.js'
import { DeclineSpareParts } from '../actions/declineSpareParts.js'
import { PayTax } from '../actions/payTax.js'
import { TaxAgentsForceTax } from '../actions/taxAgentsForceTax.js'
import { TaxAgentsTakeFromTaxBox } from '../actions/taxAgentsTakeFromTaxBox.js'
import { ActionType } from './actions.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const StellarVenturesApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassAuction]: PassAuction,
    [ActionType.IssueShare]: IssueShare,
    [ActionType.DeclineIssueShare]: DeclineIssueShare,
    [ActionType.PlaceShareBid]: PlaceShareBid,
    [ActionType.PassShareBid]: PassShareBid,
    [ActionType.ExpandNetwork]: ExpandNetwork,
    [ActionType.CreateWormhole]: CreateWormhole,
    [ActionType.DeclineExpandNetworkOrWormhole]: DeclineExpandNetworkOrWormhole,
    [ActionType.PayDividends]: PayDividends,
    [ActionType.OrderShip]: OrderShip,
    [ActionType.ForcedShipPurchase]: ForcedShipPurchase,
    [ActionType.DeclineOrderShips]: DeclineOrderShips,
    [ActionType.ReleaseDividends]: ReleaseDividends,
    [ActionType.PlaceBoardroomVote]: PlaceBoardroomVote,
    [ActionType.DeclineBoardroomVote]: DeclineBoardroomVote,
    [ActionType.ChooseBoardroomBattleCorporation]: ChooseBoardroomBattleCorporation,
    [ActionType.BlackMarket]: BlackMarket,
    [ActionType.PassInvestorAction]: PassInvestorAction,
    [ActionType.Launder]: Launder,
    [ActionType.PassAlienTechAction]: PassAlienTechAction,
    [ActionType.JerryRig]: JerryRig,
    [ActionType.PrivateContractor]: PrivateContractor,
    [ActionType.InsuranceFraud]: InsuranceFraud,
    [ActionType.CargoBoost]: CargoBoost,
    [ActionType.ResearchWormhole]: ResearchWormhole,
    [ActionType.DevelopPlanets]: DevelopPlanets,
    [ActionType.ScrapLowestShip]: ScrapLowestShip,
    [ActionType.DeliverShips]: DeliverShips,
    [ActionType.AssignTurnOrder]: AssignTurnOrder,
    [ActionType.ChooseAmethystHomePlanet]: ChooseAmethystHomePlanet,
    [ActionType.SignTheAgreement]: SignTheAgreement,
    [ActionType.DeclineSignTheAgreement]: DeclineSignTheAgreement,
    [ActionType.IncreaseAlienMiningCapacity]: IncreaseAlienMiningCapacity,
    [ActionType.IncreaseAmethystMiningCapacity]: IncreaseAmethystMiningCapacity,
    [ActionType.FinishExpansion]: FinishExpansion,
    [ActionType.Liquidate]: Liquidate,
    [ActionType.DraftPower]: DraftPower,
    [ActionType.AlienAlchemist]: AlienAlchemist,
    [ActionType.LeakedResearch]: LeakedResearch,
    [ActionType.DismantlingOutposts]: DismantlingOutposts,
    [ActionType.NebularExplorers]: NebularExplorers,
    [ActionType.FinePrint]: FinePrint,
    [ActionType.DeclineFinePrint]: DeclineFinePrint,
    [ActionType.BackroomDeal]: BackroomDeal,
    [ActionType.DeclineBackroomDeal]: DeclineBackroomDeal,
    [ActionType.DeepSpaceSmuggling]: DeepSpaceSmuggling,
    [ActionType.DeepSpacePirates]: DeepSpacePirates,
    [ActionType.DeclinePayDividendsPower]: DeclinePayDividendsPower,
    [ActionType.AlienEngineering]: AlienEngineering,
    [ActionType.SpareParts]: SpareParts,
    [ActionType.DeclineSpareParts]: DeclineSpareParts,
    [ActionType.PayTax]: PayTax,
    [ActionType.TaxAgentsForceTax]: TaxAgentsForceTax,
    [ActionType.TaxAgentsTakeFromTaxBox]: TaxAgentsTakeFromTaxBox
}
