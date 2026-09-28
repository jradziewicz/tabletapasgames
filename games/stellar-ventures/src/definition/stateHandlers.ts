import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { InitialAuctionStateHandler } from '../stateHandlers/initialAuction.js'
import { IssueShareStateHandler } from '../stateHandlers/issueShare.js'
import { ExpandNetworkOrWormholeStateHandler } from '../stateHandlers/expandNetworkOrWormhole.js'
import { PayDividendsStateHandler } from '../stateHandlers/payDividends.js'
import { OrderShipsStateHandler } from '../stateHandlers/orderShips.js'
import { ReleaseDividendsStateHandler } from '../stateHandlers/releaseDividends.js'
import { BoardroomBattleStateHandler } from '../stateHandlers/boardroomBattle.js'
import { InvestorActionStateHandler } from '../stateHandlers/investorAction.js'
import { AlienTechActionStateHandler } from '../stateHandlers/alienTechAction.js'
import { ScrapLowestShipStateHandler } from '../stateHandlers/scrapLowestShip.js'
import { PayTaxesStateHandler } from '../stateHandlers/payTaxes.js'
import { OfferTaxAgentsChoiceStateHandler } from '../stateHandlers/offerTaxAgentsChoice.js'
import { DeliverShipsStateHandler } from '../stateHandlers/deliverShips.js'
import { AssignTurnOrderStateHandler } from '../stateHandlers/assignTurnOrder.js'
import { FormAmethystAgencyStateHandler } from '../stateHandlers/formAmethystAgency.js'
import { OfferSignTheAgreementStateHandler } from '../stateHandlers/offerSignTheAgreement.js'
import { OfferSecretAgentsChoiceStateHandler } from '../stateHandlers/offerSecretAgentsChoice.js'
import { LiquidationStateHandler } from '../stateHandlers/liquidation.js'
import { DraftPowerStateHandler } from '../stateHandlers/draftPower.js'
import { OfferSparePartsStateHandler } from '../stateHandlers/offerSpareParts.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedStellarVenturesGameState } from '../model/gameState.js'

// The mapping of machine states to their handlers for Stellar Ventures, used by the game engine.
//
// NOTE: this is intentionally typed as a partial/generic record rather than
// Record<MachineState, ...>. The full MachineState enum is declared up front for design
// clarity (see states.ts), but handlers are implemented incrementally - see the game's task
// list for which states currently have a real handler.
export const StellarVenturesStateHandlers: Record<
    string,
    MachineStateHandler<HydratedAction, HydratedStellarVenturesGameState>
> = {
    [MachineState.InitialAuction]: new InitialAuctionStateHandler(),
    [MachineState.IssueShare]: new IssueShareStateHandler(),
    [MachineState.ExpandNetworkOrWormhole]: new ExpandNetworkOrWormholeStateHandler(),
    [MachineState.PayDividends]: new PayDividendsStateHandler(),
    [MachineState.OrderShips]: new OrderShipsStateHandler(),
    [MachineState.ReleaseDividends]: new ReleaseDividendsStateHandler(),
    [MachineState.BoardroomBattle]: new BoardroomBattleStateHandler(),
    [MachineState.InvestorAction]: new InvestorActionStateHandler(),
    [MachineState.AlienTechAction]: new AlienTechActionStateHandler(),
    [MachineState.ScrapLowestShip]: new ScrapLowestShipStateHandler(),
    [MachineState.DeliverShips]: new DeliverShipsStateHandler(),
    [MachineState.AssignTurnOrder]: new AssignTurnOrderStateHandler(),
    [MachineState.FormAmethystAgency]: new FormAmethystAgencyStateHandler(),
    [MachineState.OfferSignTheAgreement]: new OfferSignTheAgreementStateHandler(),
    [MachineState.OfferSecretAgentsChoice]: new OfferSecretAgentsChoiceStateHandler(),
    [MachineState.OfferTaxAgentsChoice]: new OfferTaxAgentsChoiceStateHandler(),
    [MachineState.PayTaxes]: new PayTaxesStateHandler(),
    [MachineState.DraftPower]: new DraftPowerStateHandler(),
    [MachineState.OfferSpareParts]: new OfferSparePartsStateHandler(),
    [MachineState.Liquidation]: new LiquidationStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
