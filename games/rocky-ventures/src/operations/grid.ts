import {
    MaxToolLevel,
    MaxWeaponLevel,
    canMoveRight,
    canMoveUp,
    isBlueGemCell,
    isRedGemCell,
    type GridCell
} from '../data/toolWeaponGrid.js'
import { recordGems, recordVictoryPoints } from './stats.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'

export const GridBlockedVictoryPoints = 1

export type GridDirection = 'up' | 'right'

export interface GridStepResult {
    cell: GridCell
    victoryPoints: number
    moved: boolean
}

export function stepOnGrid(cell: GridCell, direction: GridDirection): GridStepResult {
    if (direction === 'up' && canMoveUp(cell)) {
        return { cell: { weapon: cell.weapon + 1, tool: cell.tool }, victoryPoints: 0, moved: true }
    }
    if (direction === 'right' && canMoveRight(cell)) {
        return { cell: { weapon: cell.weapon, tool: cell.tool + 1 }, victoryPoints: 0, moved: true }
    }
    const atTopOfBothTracks = cell.weapon >= MaxWeaponLevel && cell.tool >= MaxToolLevel
    return {
        cell,
        victoryPoints: atTopOfBothTracks ? GridBlockedVictoryPoints : 0,
        moved: false
    }
}

export function moveOnGrid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    direction: GridDirection
) {
    const player = state.getPlayerState(playerId)
    const result = stepOnGrid({ weapon: player.weaponLevel, tool: player.toolLevel }, direction)
    if (!result.moved) {
        if (result.victoryPoints > 0) {
            player.victoryPoints += result.victoryPoints
            recordVictoryPoints(state, playerId, result.victoryPoints, 'grid')
        }
        return
    }
    player.weaponLevel = result.cell.weapon
    player.toolLevel = result.cell.tool
    if (isRedGemCell(result.cell) && !player.redMinesUnlocked) {
        player.redMinesUnlocked = true
        recordGems(state, playerId, player.addGems(1), 'grid')
    }
    if (isBlueGemCell(result.cell) && !player.blueMinesUnlocked) {
        player.blueMinesUnlocked = true
        recordGems(state, playerId, player.addGems(1), 'grid')
    }
}

export function advanceWeapon(state: HydratedRockyVenturesGameState, playerId: string) {
    moveOnGrid(state, playerId, 'up')
}

export function advanceTool(state: HydratedRockyVenturesGameState, playerId: string) {
    moveOnGrid(state, playerId, 'right')
}
