import { Images } from '$lib/images/agreements/index.js'
import {
    AgreementBackDescriptions,
    AgreementLetter,
    isTwoSidedAgreement,
    TwoSidedAgreementBacks,
    TwoSidedAgreementDeliveryPoints,
    TwoSidedAgreementPointBuys,
    type DeliveryCityId
} from '@tabletop/rocky-ventures'

// Explicit image list (scripts/generate-image-index.mjs): the Rollup game bundle can't use import.meta.glob
const agreementImagesByName: Record<string, string> = Images

// Games where an agreement's front scores on delivery show the matching front art.
let deliveryScoring = false

export function setAgreementDeliveryScoring(on: boolean) {
    deliveryScoring = on
}

let discardAllowed = true

export function setAgreementDiscardAllowed(allowed: boolean) {
    discardAllowed = allowed
}

// Two-sided agreements show their back once a later agreement from the same city flipped them.
export function agreementImageUrl(
    cityId: DeliveryCityId,
    letter: AgreementLetter,
    flipped: boolean = false
): string | undefined {
    const name = `${cityId}-${letter}${flipped && isTwoSidedAgreement(letter) ? '-back' : ''}`
    return (deliveryScoring ? agreementImagesByName[`${name}-scoring`] : undefined) ?? agreementImagesByName[name]
}

export function agreementBackImageUrl(cityId: DeliveryCityId): string | undefined {
    return agreementImagesByName[`${cityId}-back`]
}

const CityNames: Record<DeliveryCityId, string> = { dornoch: 'Dornoch', manor: 'Manor' }
const SilverHalves: Record<DeliveryCityId, string> = {
    dornoch: "The Spine, Iron's End or Gold Valley",
    manor: "Southport, Riverwood or Manor's Gate"
}

export function agreementTooltip(cityId: DeliveryCityId, letter: AgreementLetter, flipped: boolean = false): string {
    const city = CityNames[cityId]
    if (isTwoSidedAgreement(letter)) {
        const discard = discardAllowed ? 'Or discard it to lay 2 free track for one railroad.' : ''
        if (flipped) {
            const back = AgreementBackDescriptions[TwoSidedAgreementBacks[letter]!].replace('this city', city)
            return `${city} Agreement ${letter} (flipped): ${back}. ${discard}`
        }
        if (deliveryScoring) {
            const points = TwoSidedAgreementDeliveryPoints[letter]!
            return `${city} Agreement ${letter}: score ${points} VP each time you sell gold to ${city}. Taking another ${city} agreement flips this one. ${discard}`
        }
        const buy = TwoSidedAgreementPointBuys[letter]!
        return `${city} Agreement ${letter}: after a gold sale to ${city}, you may buy ${buy.victoryPoints} VP for $${buy.cost}. Taking another ${city} agreement flips this one. ${discard}`
    }
    const ability: Record<string, string> = {
        A: `+$2 per gold ore you sell to ${city}`,
        B: `+$2 per silver ore extracted from mines in ${SilverHalves[cityId]}`,
        C: `-$3 off transport and security costs when you sell gold to ${city}`,
        D: `After a gold sale to ${city} that earns $6 or more, you may buy 3 VP for $6 (not after silver sales)`
    }
    return `${city} Agreement ${letter}: ${ability[letter]}.${discardAllowed ? ' Or discard it to lay 2 free track for one railroad.' : ''}`
}
