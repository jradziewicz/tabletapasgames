import { describe, expect, it } from 'vitest'
import { CompanyId } from '../data/companies.js'
import { creditCandidatesFor } from './extract.js'

describe('delivery credit', () => {
    it('credits the railroad with the most cubes on the route', () => {
        expect(creditCandidatesFor({ [CompanyId.WingedWyrm]: 2, [CompanyId.WizardCannonball]: 1 })).toEqual([
            CompanyId.WingedWyrm
        ])
    })

    it('lets the player choose only between railroads tied for the most', () => {
        expect(
            creditCandidatesFor({ [CompanyId.WingedWyrm]: 2, [CompanyId.WizardCannonball]: 2, [CompanyId.DwarvenPacific]: 1 }).sort()
        ).toEqual([CompanyId.WizardCannonball, CompanyId.WingedWyrm].sort())
    })

    it('credits nobody when the route uses no track', () => {
        expect(creditCandidatesFor({})).toEqual([])
    })
})
