import { CorporationId, CorporationStatus } from '@tabletop/stellar-ventures'
import pinkIncOutpost from '$lib/images/outposts/pinkInc.png'
import frostFederatedOutpost from '$lib/images/outposts/frostFederated.png'
import scarletSyndicateOutpost from '$lib/images/outposts/scarletSyndicate.png'
import ceruleanCouncilOutpost from '$lib/images/outposts/ceruleanCouncil.png'
import gambogeGuildOutpost from '$lib/images/outposts/gambogeGuild.png'
import amethystAgencyOutpost from '$lib/images/outposts/amethystAgency.png'
import pinkIncLogo from '$lib/images/logos/pinkInc.png'
import frostFederatedLogo from '$lib/images/logos/frostFederated.png'
import scarletSyndicateLogo from '$lib/images/logos/scarletSyndicate.png'
import ceruleanCouncilLogo from '$lib/images/logos/ceruleanCouncil.png'
import gambogeGuildLogo from '$lib/images/logos/gambogeGuild.png'
import amethystAgencyLogo from '$lib/images/logos/amethystAgency.png'
import pinkIncCharter from '$lib/images/charters/pinkInc.png'
import frostFederatedCharter from '$lib/images/charters/frostFederated.png'
import scarletSyndicateCharter from '$lib/images/charters/scarletSyndicate.png'
import ceruleanCouncilCharter from '$lib/images/charters/ceruleanCouncil.png'
import gambogeGuildCharter from '$lib/images/charters/gambogeGuild.png'
import amethystAgencyCharter from '$lib/images/charters/amethystAgency.png'
import pinkIncPrivateBanner from '$lib/images/boardroom/pinkIncPrivate.png'
import frostFederatedPrivateBanner from '$lib/images/boardroom/frostFederatedPrivate.png'
import scarletSyndicatePrivateBanner from '$lib/images/boardroom/scarletSyndicatePrivate.png'
import ceruleanCouncilPrivateBanner from '$lib/images/boardroom/ceruleanCouncilPrivate.png'
import gambogeGuildPrivateBanner from '$lib/images/boardroom/gambogeGuildPrivate.png'
import amethystAgencyPrivateBanner from '$lib/images/boardroom/amethystAgencyPrivate.png'
import pinkIncShare from '$lib/images/shares/pinkInc.png'
import frostFederatedShare from '$lib/images/shares/frostFederated.png'
import scarletSyndicateShare from '$lib/images/shares/scarletSyndicate.png'
import ceruleanCouncilShare from '$lib/images/shares/ceruleanCouncil.png'
import gambogeGuildShare from '$lib/images/shares/gambogeGuild.png'
import amethystAgencyShare from '$lib/images/shares/amethystAgency.png'
import agreementTokenPinkInc from '$lib/images/agreement/agreementTokenPinkInc.png'
import agreementTokenFrostFederated from '$lib/images/agreement/agreementTokenFrostFederated.png'
import agreementTokenScarletSyndicate from '$lib/images/agreement/agreementTokenScarletSyndicate.png'
import agreementTokenCeruleanCouncil from '$lib/images/agreement/agreementTokenCeruleanCouncil.png'
import agreementTokenGambogeGuild from '$lib/images/agreement/agreementTokenGambogeGuild.png'
import gambogeMajorStatus from '$lib/images/status/gambogeMajor.png'
import gambogeMinorStatus from '$lib/images/status/gambogeMinor.png'
import scarletMajorStatus from '$lib/images/status/scarletMajor.png'
import scarletMinorStatus from '$lib/images/status/scarletMinor.png'
import frostMajorStatus from '$lib/images/status/frostMajor.png'
import frostMinorStatus from '$lib/images/status/frostMinor.png'
import ceruleanMajorStatus from '$lib/images/status/ceruleanMajor.png'
import ceruleanMinorStatus from '$lib/images/status/ceruleanMinor.png'
import pinkMajorStatus from '$lib/images/status/pinkMajor.png'
import pinkMinorStatus from '$lib/images/status/pinkMinor.png'
import amethystPrivateStatus from '$lib/images/status/amethystPrivate.png'
import amethystMinorStatus from '$lib/images/status/amethystMinor.png'

// Real corporation names only exist as comments in the logic package (the enum values are
// bare ids like 'pinkInc') - this is the single place the UI turns those into display text.
export const CorporationDisplayNames: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: 'Pink Inc.',
    [CorporationId.FrostFederated]: 'Frost Federated',
    [CorporationId.ScarletSyndicate]: 'Scarlet Syndicate',
    [CorporationId.CeruleanCouncil]: 'Cerulean Council',
    [CorporationId.GambogeGuild]: 'Gamboge Guild',
    [CorporationId.AmethystAgency]: 'Amethyst Agency'
}

// Placeholder Corporation colors until real branding/art is uploaded (see the game's task
// list - "Integrate art assets"). Shared by Board.svelte, PlayersPanel.svelte and any
// per-phase panels (e.g. InitialAuctionPanel.svelte) so they stay in sync.
export const CorporationColors: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: '#ec4899',
    [CorporationId.FrostFederated]: '#38bdf8',
    [CorporationId.ScarletSyndicate]: '#dc2626',
    [CorporationId.CeruleanCouncil]: '#0ea5e9',
    [CorporationId.GambogeGuild]: '#f59e0b',
    [CorporationId.AmethystAgency]: '#a855f7'
}

// Real Outpost marker art (from SV_WOODEN_01, a set of 3D wooden-piece renders - one per
// Corporation, matching page order 1-6). Confirmed by the game's co-designer: Frost Federated
// is the white piece (frost/ice) and Cerulean Council is the blue piece (cerulean = sky blue) -
// the reverse of what the color alone would suggest next to this file's placeholder hex colors.
export const CorporationOutpostIcons: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: pinkIncOutpost,
    [CorporationId.FrostFederated]: frostFederatedOutpost,
    [CorporationId.ScarletSyndicate]: scarletSyndicateOutpost,
    [CorporationId.CeruleanCouncil]: ceruleanCouncilOutpost,
    [CorporationId.GambogeGuild]: gambogeGuildOutpost,
    [CorporationId.AmethystAgency]: amethystAgencyOutpost
}

// Real Corporation logo art (one vector logo per Corporation, provided directly as
// per-Corporation PDFs and trimmed to each logo's own bounding box). Used anywhere a
// Corporation's identity should read at a glance without its full name - e.g. next to its
// name in the Corporations list, or in place of its name in a per-player Share holdings line.
export const CorporationLogoIcons: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: pinkIncLogo,
    [CorporationId.FrostFederated]: frostFederatedLogo,
    [CorporationId.ScarletSyndicate]: scarletSyndicateLogo,
    [CorporationId.CeruleanCouncil]: ceruleanCouncilLogo,
    [CorporationId.GambogeGuild]: gambogeGuildLogo,
    [CorporationId.AmethystAgency]: amethystAgencyLogo
}

// Width/height of each logo's own trimmed art, so a logo sized by height alone still renders
// at its real proportions instead of being stretched or squashed.
export const CorporationLogoAspect: Record<CorporationId, number> = {
    [CorporationId.PinkInc]: 532 / 709,
    [CorporationId.FrostFederated]: 606 / 686,
    [CorporationId.ScarletSyndicate]: 625 / 625,
    [CorporationId.CeruleanCouncil]: 494 / 709,
    [CorporationId.GambogeGuild]: 733 / 576,
    [CorporationId.AmethystAgency]: 786 / 610
}

// Real Corporation Charter art (2nd-generation renders, one full player-mat PNG per
// Corporation - matching CorporationOutpostIcons' own page order): each Corporation's own
// portrait, home planet, printed cost table, Cargo/Wormhole markers, a 3-slot "Ordered Ships"
// tracker, and a "Delivered Ships" badge. Real PNGs with transparent cut corners (the mat's own
// octagonal shape) rather than the earlier plain rectangular JPGs, so CorporationCharter.svelte
// no longer draws its own border/rounded-rect over them. All 6 share one aspect ratio (they're
// renders of the same physical mat size).
export const CorporationCharterIcons: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: pinkIncCharter,
    [CorporationId.FrostFederated]: frostFederatedCharter,
    [CorporationId.ScarletSyndicate]: scarletSyndicateCharter,
    [CorporationId.CeruleanCouncil]: ceruleanCouncilCharter,
    [CorporationId.GambogeGuild]: gambogeGuildCharter,
    [CorporationId.AmethystAgency]: amethystAgencyCharter
}

// Measured directly against the new Charter renders (2127x1536, all identical since they're the
// same physical mat).
export const CHARTER_ASPECT = 2127 / 1536

// Boardroom Battle vote-space banners (see BoardroomBattlePanel.svelte) - one per Corporation,
// each a wide banner with that Corporation's logo, "PRIVATE", and a striped area where vote
// tokens (see playerSymbolDisplay.ts's PlayerVoteTokenIcons) get placed. Named "Private"
// because the co-designer plans separate Minor/Major banner art later (a Corporation's
// CorporationStatus - Private/Minor/Major - is purely a display label derived from its issued
// Share count, not a rules branch in the Boardroom Battle mechanic itself - see
// operations/boardroomBattle.ts), so this record will grow a Minor/Major counterpart once
// that art exists rather than being renamed. All 6 share one aspect ratio (1361x404).
export const CorporationPrivateVoteBanners: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: pinkIncPrivateBanner,
    [CorporationId.FrostFederated]: frostFederatedPrivateBanner,
    [CorporationId.ScarletSyndicate]: scarletSyndicatePrivateBanner,
    [CorporationId.CeruleanCouncil]: ceruleanCouncilPrivateBanner,
    [CorporationId.GambogeGuild]: gambogeGuildPrivateBanner,
    [CorporationId.AmethystAgency]: amethystAgencyPrivateBanner
}

export const BOARDROOM_BANNER_ASPECT = 1361 / 404

// Real Share Certificate card art (SV_SHARE_CERT_44x67mm_CARDS - front face only; one design
// per Corporation, matching that PDF's own page groups of 5/5/5/5/5/3, which line up exactly
// with SHARES_FOR_CORPORATION). Every certificate for a given Corporation is identical art (no
// per-share serial numbers), so one representative image per Corporation is enough to stand in
// for "the Share currently up for auction" (see ShareAuctionPanel.svelte) and for the physical
// stack of not-yet-issued Shares still sitting on that Corporation's own Charter (see
// CorporationCharter.svelte).
export const CorporationShareCertificateIcons: Record<CorporationId, string> = {
    [CorporationId.PinkInc]: pinkIncShare,
    [CorporationId.FrostFederated]: frostFederatedShare,
    [CorporationId.ScarletSyndicate]: scarletSyndicateShare,
    [CorporationId.CeruleanCouncil]: ceruleanCouncilShare,
    [CorporationId.GambogeGuild]: gambogeGuildShare,
    [CorporationId.AmethystAgency]: amethystAgencyShare
}

// Measured directly off the card renders (1725x1182, all identical since they're the same
// physical card size).
export const SHARE_CERTIFICATE_ASPECT = 1725 / 1182
// The co-designer's own colored handshake tokens - the actual physical Agreement Token piece
// per Corporation (per the co-designer: "the agreement token is the handshake"), one single
// token that just moves between two spots rather than two different pieces: it sits on the
// Agreement/Charter tabs as a plain "Has not signed The Agreement" marker
// (AgreementPanel.svelte, CorporationStatsTable.svelte, OfferSignTheAgreementPanel.svelte) right
// up until that Corporation actually signs, at which point that same token (this same art) moves
// onto its column of the Agreement Track itself (see signTheAgreement.ts step 3, "Place the
// Agreement Token") - it does not get replaced by some other icon (an Outpost icon, say) once
// placed there. Colors are per-Corporation (Pink Inc = pink, Scarlet Syndicate = red/crimson,
// Gamboge Guild = orange/gold, Cerulean Council = teal), except Frost Federated, which gets the
// plain black-and-white (no color fill) token - it's the Corporation's own real physical piece
// color (see CorporationOutpostIcons' comment above). Amethyst Agency has NO entry here at all:
// per the rulebook it can never sign The Agreement (it forms too late in the game to qualify), so
// a missing entry means "not applicable," not "art not drawn yet" - callers should fall back to
// something else (or nothing) rather than treating this as incomplete.
export const CorporationAgreementTokenIcons: Partial<Record<CorporationId, string>> = {
    [CorporationId.PinkInc]: agreementTokenPinkInc,
    [CorporationId.FrostFederated]: agreementTokenFrostFederated,
    [CorporationId.ScarletSyndicate]: agreementTokenScarletSyndicate,
    [CorporationId.CeruleanCouncil]: agreementTokenCeruleanCouncil,
    [CorporationId.GambogeGuild]: agreementTokenGambogeGuild
}

// The co-designer's own printed Corporate Status markers, physically die-cut from the
// punchboard (SV_PUNCHBOARD_FINAL.pdf) - one small piece per Corporation showing its current
// CorporationStatus (Private/Minor/Major - see model/corporation.ts's
// HydratedCorporationState.status, a pure display label derived from issued Share count).
// Cropped directly from the punchboard art using the companion cutter/die-line PDF to find each
// piece's exact printed boundaries, then used exactly as printed per the co-designer's own call
// ("use each piece exactly as printed") rather than unifying Major's solid-color-box style with
// Minor's text+swatch style - the two tiers are printed as genuinely different piece designs.
// Every Corporation's piece is the same physical height (588px at the extraction's working
// resolution); only the printed word's width differs, so these are used at a fixed height with
// width left to each image's own intrinsic aspect ratio rather than a shared aspect constant.
//
// Private has no physical piece for 5 of the 6 Corporations - per the co-designer, a
// Corporation starts Private and simply shows no marker at all until it actually reaches Minor
// or Major, the same "nothing printed yet" idea CorporationAgreementTokenIcons' own missing
// entries use. Amethyst Agency is the one exception, in both directions: it gets an explicit
// "PRIVATE" piece (keyed to CorporationStatus.Private below) instead of showing nothing, and it
// has no Major piece at all - per the co-designer, Amethyst Agency only ever has 3 Shares total
// (SHARES_FOR_CORPORATION, definition/initializer.ts) against a Major threshold of 4 (5 with
// Stalled IPO - see HydratedCorporationState.statusForIssuedShareCount), so it can mechanically
// never reach Major and permanently caps out at Minor. The "PRIVATE" piece calling that out
// explicitly (rather than reverting to a blank corner once Amethyst leaves its own starting
// state at 2+ Shares issued... which for Amethyst never actually leaves Private/Minor) is why it
// exists at all where the other 5 Corporations don't need one.
export const CorporationStatusIcons: Partial<Record<CorporationId, Partial<Record<CorporationStatus, string>>>> = {
    [CorporationId.GambogeGuild]: {
        [CorporationStatus.Minor]: gambogeMinorStatus,
        [CorporationStatus.Major]: gambogeMajorStatus
    },
    [CorporationId.ScarletSyndicate]: {
        [CorporationStatus.Minor]: scarletMinorStatus,
        [CorporationStatus.Major]: scarletMajorStatus
    },
    [CorporationId.FrostFederated]: {
        [CorporationStatus.Minor]: frostMinorStatus,
        [CorporationStatus.Major]: frostMajorStatus
    },
    [CorporationId.CeruleanCouncil]: {
        [CorporationStatus.Minor]: ceruleanMinorStatus,
        [CorporationStatus.Major]: ceruleanMajorStatus
    },
    [CorporationId.PinkInc]: {
        [CorporationStatus.Minor]: pinkMinorStatus,
        [CorporationStatus.Major]: pinkMajorStatus
    },
    [CorporationId.AmethystAgency]: {
        [CorporationStatus.Private]: amethystPrivateStatus,
        [CorporationStatus.Minor]: amethystMinorStatus
    }
}
