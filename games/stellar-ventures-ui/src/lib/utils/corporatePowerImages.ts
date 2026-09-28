import { CorporationId, CorporatePowerId } from '@tabletop/stellar-ventures'

// Real punchboard art for the Corporate Power tiles (SV_PUNCHBOARD_FINAL, cut out along
// SV_PUNCHBOARD_CUTTER_FINAL's die lines - see the game's asset pipeline notes). Every physical
// tile is double-sided:
//   - The 18 Neutral powers (operations/corporatePowers.ts's NeutralCorporatePowerIds) print a
//     compact icon-only face on one side and the full rules text spelled out on the other - both
//     sides are the SAME power, just two different levels of detail. `Front` (icon) is used
//     wherever space is tight (the Corporation Charter's own active-power slot); `Back` (full
//     text) is used for DraftPowerPanel's picker, where a player is choosing a Power for the
//     first time and wants the whole rule in front of them.
//   - AlienExplorers and SecretAgents (Starting/Formation Powers - never drafted, see
//     corporatePowers.ts) are different: their physical tile's "front" face prints an unrelated
//     power (a corporation-colored "Sign The Agreement" reminder card for AlienExplorers, "Tax
//     Agents" - a Borders & Taxes Map power out of scope for this implementation - for
//     SecretAgents). The side that actually reads "Alien Explorers" / "Secret Agents" is the
//     BACK, so only the back art is imported for these.
import accountingGimmickFront from '$lib/images/powers/accountingGimmick_front.png'
import accountingGimmickBack from '$lib/images/powers/accountingGimmick_back.png'
import leakedResearchFront from '$lib/images/powers/leakedResearch_front.png'
import leakedResearchBack from '$lib/images/powers/leakedResearch_back.png'
import alienEngineeringFront from '$lib/images/powers/alienEngineering_front.png'
import alienEngineeringBack from '$lib/images/powers/alienEngineering_back.png'
import cloakingDevicesFront from '$lib/images/powers/cloakingDevices_front.png'
import cloakingDevicesBack from '$lib/images/powers/cloakingDevices_back.png'
import deepSpaceSmugglingFront from '$lib/images/powers/deepSpaceSmuggling_front.png'
import deepSpaceSmugglingBack from '$lib/images/powers/deepSpaceSmuggling_back.png'
import finePrintFront from '$lib/images/powers/finePrint_front.png'
import finePrintBack from '$lib/images/powers/finePrint_back.png'
import icarusExperimentFront from '$lib/images/powers/icarusExperiment_front.png'
import icarusExperimentBack from '$lib/images/powers/icarusExperiment_back.png'
import alienAlchemistFront from '$lib/images/powers/alienAlchemist_front.png'
import alienAlchemistBack from '$lib/images/powers/alienAlchemist_back.png'
import backroomDealFront from '$lib/images/powers/backroomDeal_front.png'
import backroomDealBack from '$lib/images/powers/backroomDeal_back.png'
import deepSpacePiratesFront from '$lib/images/powers/deepSpacePirates_front.png'
import deepSpacePiratesBack from '$lib/images/powers/deepSpacePirates_back.png'
import dismantlingOutpostsFront from '$lib/images/powers/dismantlingOutposts_front.png'
import dismantlingOutpostsBack from '$lib/images/powers/dismantlingOutposts_back.png'
import hyperdriveFront from '$lib/images/powers/hyperdrive_front.png'
import hyperdriveBack from '$lib/images/powers/hyperdrive_back.png'
import stalledIPOFront from '$lib/images/powers/stalledIPO_front.png'
import stalledIPOBack from '$lib/images/powers/stalledIPO_back.png'
import sparePartsFront from '$lib/images/powers/spareParts_front.png'
import sparePartsBack from '$lib/images/powers/spareParts_back.png'
import oreRefinementFront from '$lib/images/powers/oreRefinement_front.png'
import oreRefinementBack from '$lib/images/powers/oreRefinement_back.png'
import quantumPropulsionFront from '$lib/images/powers/quantumPropulsion_front.png'
import quantumPropulsionBack from '$lib/images/powers/quantumPropulsion_back.png'
import nebularExplorersFront from '$lib/images/powers/nebularExplorers_front.png'
import nebularExplorersBack from '$lib/images/powers/nebularExplorers_back.png'
import windfallFront from '$lib/images/powers/windfall_front.png'
import windfallBack from '$lib/images/powers/windfall_back.png'

import alienExplorersPinkInc from '$lib/images/powers/alienExplorers_pinkInc_back.png'
import alienExplorersFrostFederated from '$lib/images/powers/alienExplorers_frostFederated_back.png'
import alienExplorersScarletSyndicate from '$lib/images/powers/alienExplorers_scarletSyndicate_back.png'
import alienExplorersCeruleanCouncil from '$lib/images/powers/alienExplorers_ceruleanCouncil_back.png'
import alienExplorersGambogeGuild from '$lib/images/powers/alienExplorers_gambogeGuild_back.png'
import secretAgentsAmethystAgency from '$lib/images/powers/secretAgents_amethystAgency_back.png'
import taxAgentsAmethystAgency from '$lib/images/powers/taxAgents_amethystAgency_front.png'

// AlienExplorers' own "front" face - a corporation-colored "Sign The Agreement" reminder card
// (see file header) - recovered from the physical punchboard scans and matched to each
// Corporation's back art via perceptual hash. Used ONLY by the Sign The Agreement walkthrough
// (Board.svelte) to show the held AlienExplorers Power visually flipping to this side as step 1
// of that sequence - NOT wired into powerHasTwoSides/activePowerCardImageForSide, so a normal
// click on the Charter's Power slot still doesn't flip it (that flip is walkthrough-driven, not
// player-driven). SecretAgents' matching "Tax Agents" front exists in the same scan set but is
// out of scope (see file header) and intentionally not imported.
import alienExplorersPinkIncSignTheAgreement from '$lib/images/powers/alienExplorers_pinkInc_front.png'
import alienExplorersFrostFederatedSignTheAgreement from '$lib/images/powers/alienExplorers_frostFederated_front.png'
import alienExplorersScarletSyndicateSignTheAgreement from '$lib/images/powers/alienExplorers_scarletSyndicate_front.png'
import alienExplorersCeruleanCouncilSignTheAgreement from '$lib/images/powers/alienExplorers_ceruleanCouncil_front.png'
import alienExplorersGambogeGuildSignTheAgreement from '$lib/images/powers/alienExplorers_gambogeGuild_front.png'

// Every Corporate Power tile is die-cut to the same physical size/shape (two rounded corners,
// two diagonally-chamfered corners, mirrored front-to-back) - one shared aspect ratio for
// whatever CSS box hosts any of this file's images, front or back, Neutral or Starting.
export const POWER_CARD_ASPECT = 788 / 583

// Only the 18 Neutral powers ever show a "compact icon" face - AlienExplorers/SecretAgents have
// no icon face of their own (see file header), so these two maps are intentionally partial.
export const CorporatePowerFrontImages: Partial<Record<string, string>> = {
    [CorporatePowerId.AccountingGimmick]: accountingGimmickFront,
    [CorporatePowerId.LeakedResearch]: leakedResearchFront,
    [CorporatePowerId.AlienEngineering]: alienEngineeringFront,
    [CorporatePowerId.CloakingDevices]: cloakingDevicesFront,
    [CorporatePowerId.DeepSpaceSmuggling]: deepSpaceSmugglingFront,
    [CorporatePowerId.FinePrint]: finePrintFront,
    [CorporatePowerId.IcarusExperiment]: icarusExperimentFront,
    [CorporatePowerId.AlienAlchemist]: alienAlchemistFront,
    [CorporatePowerId.BackroomDeal]: backroomDealFront,
    [CorporatePowerId.DeepSpacePirates]: deepSpacePiratesFront,
    [CorporatePowerId.DismantlingOutposts]: dismantlingOutpostsFront,
    [CorporatePowerId.Hyperdrive]: hyperdriveFront,
    [CorporatePowerId.StalledIPO]: stalledIPOFront,
    [CorporatePowerId.SpareParts]: sparePartsFront,
    [CorporatePowerId.OreRefinement]: oreRefinementFront,
    [CorporatePowerId.QuantumPropulsion]: quantumPropulsionFront,
    [CorporatePowerId.NebularExplorers]: nebularExplorersFront,
    [CorporatePowerId.Windfall]: windfallFront
}

export const CorporatePowerBackImages: Partial<Record<string, string>> = {
    [CorporatePowerId.AccountingGimmick]: accountingGimmickBack,
    [CorporatePowerId.LeakedResearch]: leakedResearchBack,
    [CorporatePowerId.AlienEngineering]: alienEngineeringBack,
    [CorporatePowerId.CloakingDevices]: cloakingDevicesBack,
    [CorporatePowerId.DeepSpaceSmuggling]: deepSpaceSmugglingBack,
    [CorporatePowerId.FinePrint]: finePrintBack,
    [CorporatePowerId.IcarusExperiment]: icarusExperimentBack,
    [CorporatePowerId.AlienAlchemist]: alienAlchemistBack,
    [CorporatePowerId.BackroomDeal]: backroomDealBack,
    [CorporatePowerId.DeepSpacePirates]: deepSpacePiratesBack,
    [CorporatePowerId.DismantlingOutposts]: dismantlingOutpostsBack,
    [CorporatePowerId.Hyperdrive]: hyperdriveBack,
    [CorporatePowerId.StalledIPO]: stalledIPOBack,
    [CorporatePowerId.SpareParts]: sparePartsBack,
    [CorporatePowerId.OreRefinement]: oreRefinementBack,
    [CorporatePowerId.QuantumPropulsion]: quantumPropulsionBack,
    [CorporatePowerId.NebularExplorers]: nebularExplorersBack,
    [CorporatePowerId.Windfall]: windfallBack
}

// AlienExplorers is corporation-colored on the physical punchboard (each starting Corporation
// drew its own tile) - Amethyst Agency doesn't have one at all (its Formation Power is
// SecretAgents instead, see model/corporation.ts).
const AlienExplorersImageByCorporation: Partial<Record<CorporationId, string>> = {
    [CorporationId.PinkInc]: alienExplorersPinkInc,
    [CorporationId.FrostFederated]: alienExplorersFrostFederated,
    [CorporationId.ScarletSyndicate]: alienExplorersScarletSyndicate,
    [CorporationId.CeruleanCouncil]: alienExplorersCeruleanCouncil,
    [CorporationId.GambogeGuild]: alienExplorersGambogeGuild
}

export type PowerCardSide = 'front' | 'back'

// Plain lookup for the 18 Neutral powers, where both faces are always digitized and neither
// needs to know which Corporation (if any) holds it - used by DraftPowerPanel and the Initial
// Auction's "Available Corporate Powers" reference row, which only ever show Neutral powers.
export function powerCardImageForSide(powerId: string, side: PowerCardSide): string | undefined {
    return side === 'front' ? CorporatePowerFrontImages[powerId] : CorporatePowerBackImages[powerId]
}

/**
 * The card-art image to represent `powerId` as currently HELD by `corporationId`, for compact
 * display (e.g. the Corporation Charter's active-power slot - CharterPanel.svelte), for
 * whichever `side` is currently showing. AlienExplorers/SecretAgents ignore `side` and always
 * return their one digitized face (see file header - their real physical front prints an
 * unrelated, out-of-scope power, so there's nothing else to flip to for them). Returns undefined
 * only if we have no art for this id at all, which shouldn't happen for any Power a Corporation
 * can actually hold.
 */
export function activePowerCardImageForSide(
    corporationId: CorporationId,
    powerId: string,
    side: PowerCardSide
): string | undefined {
    if (powerId === CorporatePowerId.AlienExplorers) {
        return AlienExplorersImageByCorporation[corporationId]
    }
    if (powerId === CorporatePowerId.SecretAgents) {
        return secretAgentsAmethystAgency
    }
    if (powerId === CorporatePowerId.TaxAgents) {
        return taxAgentsAmethystAgency
    }
    return powerCardImageForSide(powerId, side)
}

// Whether clicking to flip this Power actually shows something different - false for
// AlienExplorers/SecretAgents, which only have one digitized face (see above).
export function powerHasTwoSides(powerId: string): boolean {
    return (
        powerId !== CorporatePowerId.AlienExplorers &&
        powerId !== CorporatePowerId.SecretAgents &&
        powerId !== CorporatePowerId.TaxAgents
    )
}

// AlienExplorers' corporation-colored "Sign The Agreement" reminder-card face (see the import
// comment above) - used by the Sign The Agreement walkthrough's own step 1 ("Flip Power") to show
// the held Power flipping to this side, independent of the Charter's normal front/back toggle.
const AlienExplorersSignTheAgreementImageByCorporation: Partial<Record<CorporationId, string>> = {
    [CorporationId.PinkInc]: alienExplorersPinkIncSignTheAgreement,
    [CorporationId.FrostFederated]: alienExplorersFrostFederatedSignTheAgreement,
    [CorporationId.ScarletSyndicate]: alienExplorersScarletSyndicateSignTheAgreement,
    [CorporationId.CeruleanCouncil]: alienExplorersCeruleanCouncilSignTheAgreement,
    [CorporationId.GambogeGuild]: alienExplorersGambogeGuildSignTheAgreement
}

export function alienExplorersSignTheAgreementImage(
    corporationId: CorporationId
): string | undefined {
    return AlienExplorersSignTheAgreementImageByCorporation[corporationId]
}
