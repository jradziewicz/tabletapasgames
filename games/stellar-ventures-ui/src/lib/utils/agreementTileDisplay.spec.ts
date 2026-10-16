import { describe, expect, it } from 'vitest'
import { CorporationId } from '@tabletop/stellar-ventures'
import { findSignedAgreementHex } from './agreementTileDisplay.js'

// Shaped like the live game that showed one 4-chevron tile for two Corporations: Pink and
// Cerulean share hex 1,1, which Pink signed on; Cerulean signed on 4,5 (shared with Gamboge),
// and Gamboge on -3,6.
const hex = (id: string, outposts: string[], chevrons: number, hidden: boolean) =>
    ({ id, outposts, alienAgreementTileChevrons: chevrons, alienAgreementTileHidden: hidden }) as never

const hexes = [
    hex('6,0', [CorporationId.PinkInc, CorporationId.CeruleanCouncil], 4, true),
    hex('1,1', [CorporationId.CeruleanCouncil, CorporationId.PinkInc], 2, false),
    hex('4,5', [CorporationId.GambogeGuild, CorporationId.FrostFederated, CorporationId.CeruleanCouncil], 3, false),
    hex('-3,6', [CorporationId.GambogeGuild], 1, false)
]

describe('findSignedAgreementHex', () => {
    it('uses the recorded signing hex when there is one', () => {
        const corporations = [
            { id: CorporationId.CeruleanCouncil, agreement: { hexId: '4,5' } },
            { id: CorporationId.PinkInc, agreement: { hexId: '1,1' } }
        ]
        expect((findSignedAgreementHex(hexes, CorporationId.CeruleanCouncil, corporations) as { id: string }).id).toBe('4,5')
    })

    it('never gives one flipped tile to two Corporations for older signings', () => {
        const corporations = [
            { id: CorporationId.CeruleanCouncil, agreement: {} },
            { id: CorporationId.PinkInc, agreement: {} },
            { id: CorporationId.GambogeGuild, agreement: {} }
        ]
        const signed = Object.fromEntries(
            corporations.map((c) => [
                c.id,
                (findSignedAgreementHex(hexes, c.id, corporations) as { id: string } | undefined)?.id
            ])
        )
        expect(signed).toEqual({
            [CorporationId.PinkInc]: '1,1',
            [CorporationId.CeruleanCouncil]: '4,5',
            [CorporationId.GambogeGuild]: '-3,6'
        })
    })
})
