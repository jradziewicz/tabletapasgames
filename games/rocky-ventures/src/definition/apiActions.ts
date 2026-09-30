import type * as Type from 'typebox'
import { ActionType } from './actions.js'
import { MovePawn } from '../actions/movePawn.js'
import { Tax } from '../actions/tax.js'
import { Invest } from '../actions/invest.js'
import { ChooseShare } from '../actions/chooseShare.js'
import { PointBuy } from '../actions/pointBuy.js'
import { ClaimMine } from '../actions/claimMine.js'
import { LayTrack } from '../actions/layTrack.js'
import { ExtractAndSell } from '../actions/extractAndSell.js'
import { Hunt } from '../actions/hunt.js'
import { Acquire } from '../actions/acquire.js'
import { GemAction } from '../actions/gemAction.js'
import { AgreementPointBuy } from '../actions/agreementPointBuy.js'
import { DiscardAgreement } from '../actions/discardAgreement.js'
import { LayFreeTrack } from '../actions/layFreeTrack.js'
import { SellVictoryPoints } from '../actions/sellVictoryPoints.js'
import { ResolveHunt } from '../actions/resolveHunt.js'
import { SkipBonusInvest } from '../actions/skipBonusInvest.js'
import { EndTurn } from '../actions/endTurn.js'

export const RockyVenturesApiActions: Record<string, Type.TSchema> = {
    [ActionType.MovePawn]: MovePawn,
    [ActionType.Tax]: Tax,
    [ActionType.Invest]: Invest,
    [ActionType.ChooseShare]: ChooseShare,
    [ActionType.PointBuy]: PointBuy,
    [ActionType.ClaimMine]: ClaimMine,
    [ActionType.LayTrack]: LayTrack,
    [ActionType.ExtractAndSell]: ExtractAndSell,
    [ActionType.Hunt]: Hunt,
    [ActionType.Acquire]: Acquire,
    [ActionType.GemAction]: GemAction,
    [ActionType.AgreementPointBuy]: AgreementPointBuy,
    [ActionType.DiscardAgreement]: DiscardAgreement,
    [ActionType.LayFreeTrack]: LayFreeTrack,
    [ActionType.SellVictoryPoints]: SellVictoryPoints,
    [ActionType.ResolveHunt]: ResolveHunt,
    [ActionType.SkipBonusInvest]: SkipBonusInvest,
    [ActionType.EndTurn]: EndTurn
}
