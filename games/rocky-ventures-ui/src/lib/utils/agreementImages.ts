import type { AgreementLetter, DeliveryCityId } from '@tabletop/rocky-ventures'

const agreementImageModules = import.meta.glob<string>('$lib/images/agreements/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const agreementImagesByName: Record<string, string> = Object.fromEntries(
    Object.entries(agreementImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

export function agreementImageUrl(cityId: DeliveryCityId, letter: AgreementLetter): string | undefined {
    return agreementImagesByName[`${cityId}-${letter}`]
}

export function agreementBackImageUrl(cityId: DeliveryCityId): string | undefined {
    return agreementImagesByName[`${cityId}-back`]
}

const CityNames: Record<DeliveryCityId, string> = { dornoch: 'Dornoch', manor: 'Manor' }
const SilverHalves: Record<DeliveryCityId, string> = {
    dornoch: "The Spine, Iron's End or Gold Valley",
    manor: "Southport, Riverwood or Manor's Gate"
}

export function agreementTooltip(cityId: DeliveryCityId, letter: AgreementLetter): string {
    const city = CityNames[cityId]
    const ability: Record<AgreementLetter, string> = {
        A: `+$2 per gold ore you sell to ${city}`,
        B: `+$2 per silver ore extracted from mines in ${SilverHalves[cityId]}`,
        C: `-$3 off transport and security costs when you sell gold to ${city}`,
        D: `After a sale to ${city} that earns $6 or more, you may buy 3 VP for $6`
    }
    return `${city} Agreement ${letter}: ${ability[letter]}. Or discard it to lay 2 free track for one railroad.`
}
