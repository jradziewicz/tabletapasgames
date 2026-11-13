import { describe, expect, it } from 'vitest'
import type { StellarVenturesGameState } from '../model/gameState.js'
import { StellarVenturesProgression } from './progression.js'
import { MachineState } from './states.js'

const progress = (machineState: MachineState, era: number) =>
    new StellarVenturesProgression().progress({ machineState, era } as StellarVenturesGameState)

describe('StellarVenturesProgression', () => {
    it('starts at the Initial Auction', () => {
        expect(progress(MachineState.InitialAuction, 1)).toEqual({ fraction: 0, label: 'Initial Auction' })
    })

    it('counts whole Eras and never goes backwards within one', () => {
        expect(progress(MachineState.IssueShare, 2)).toEqual({ fraction: 1 / 4.5, label: 'Era 2 of 5' })
        expect(progress(MachineState.InvestorAction, 2).fraction).toBe(1 / 4.5)
    })

    it('marks the final Era and Liquidation as final', () => {
        expect(progress(MachineState.OrderShips, 5)).toEqual({ fraction: 4 / 4.5, label: 'Final era', final: true })
        expect(progress(MachineState.Liquidation, 5)).toEqual({ fraction: 1, label: 'Liquidation', final: true })
    })
})
