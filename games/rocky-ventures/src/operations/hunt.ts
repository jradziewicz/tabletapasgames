import { Prng, pickRandom } from '@tabletop/common'
import { CardActionKind } from '../data/cards.js'
import { RegionIds } from '../data/regions.js'
import {
    BonusGemMinimumWeaponLevel,
    BonusGoldAmount,
    BonusInvestMinimumWeaponLevel,
    HuntDrawRuleByWeaponLevel,
    VictoryPointsPerHit,
    WeaponTokenKind
} from '../data/weaponBag.js'
import { BonusTokensToSummonDragon, DragonLevel } from '../data/scourges.js'
import { recordActionStat, recordCash, recordGems, recordVictoryPoints } from './stats.js'
import type { HydratedRockyVenturesGameState } from '../model/gameState.js'
import { advanceWeapon } from './grid.js'
import { currentPlayerId, remainingActionKinds } from './turn.js'

export const DragonHuntRegion = 'dragon'
export const ClaimHuntMarker = 'claimHunt'

export interface HuntTarget {
    id: string
    level: number
    hits: number
}

export function dragonIsActive(state: HydratedRockyVenturesGameState): boolean {
    return state.dragon.summoned && !state.dragon.killed
}

export function huntTargets(state: HydratedRockyVenturesGameState, region: string): HuntTarget[] {
    if (region === DragonHuntRegion) {
        return dragonIsActive(state)
            ? [{ id: DragonHuntRegion, level: DragonLevel, hits: state.dragon.hits }]
            : []
    }
    return (state.board.scourgesByRegion[region] ?? []).map((scourge) => ({
        id: scourge.scourgeId,
        level: scourge.level,
        hits: scourge.hits
    }))
}

export function huntableRegions(state: HydratedRockyVenturesGameState): string[] {
    const regions: string[] = RegionIds.filter((region) => huntTargets(state, region).length > 0)
    if (dragonIsActive(state)) {
        regions.push(DragonHuntRegion)
    }
    return regions
}

export function huntRule(state: HydratedRockyVenturesGameState, playerId: string) {
    const level = state.getPlayerState(playerId).weaponLevel
    return HuntDrawRuleByWeaponLevel[level] ?? HuntDrawRuleByWeaponLevel[1]!
}

function drawFromBag(state: HydratedRockyVenturesGameState, count: number): WeaponTokenKind[] {
    const random = new Prng(state.prng).random
    const drawn: WeaponTokenKind[] = []
    for (let draw = 0; draw < count; draw += 1) {
        const pool: WeaponTokenKind[] = []
        for (const kind of Object.values(WeaponTokenKind)) {
            for (let copy = 0; copy < (state.weaponBag[kind] ?? 0); copy += 1) {
                pool.push(kind)
            }
        }
        if (pool.length === 0) {
            break
        }
        const kind = pickRandom(pool, random)
        state.weaponBag[kind] = (state.weaponBag[kind] ?? 0) - 1
        drawn.push(kind)
    }
    return drawn
}

export function startHunt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    region: string,
    marker: string
) {
    const rule = huntRule(state, playerId)
    state.pendingHunt = { region, drawn: drawFromBag(state, rule.draw), apply: rule.apply }
    recordActionStat(state, playerId, marker === CardActionKind.Hunt ? 'Hunt' : 'ClaimHunt')
    state.turnActionsTaken.push(marker)
}

export function reasonHuntInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    region: string
): string | undefined {
    if (!state.activePlayerIds.includes(playerId)) {
        return 'It is not your turn'
    }
    if (state.pendingHunt) {
        return 'Finish the current hunt first'
    }
    if (!remainingActionKinds(state).includes(CardActionKind.Hunt)) {
        return 'Hunt is not available on this card'
    }
    if (!huntableRegions(state).includes(region)) {
        return 'There is nothing to hunt in that region'
    }
    return undefined
}

export function anyHuntableRegion(
    state: HydratedRockyVenturesGameState,
    playerId: string
): boolean {
    return huntableRegions(state).some((region) => reasonHuntInvalid(state, playerId, region) === undefined)
}

export function claimHuntAvailable(state: HydratedRockyVenturesGameState, playerId: string): boolean {
    const allowed = state.actionCardActions(playerId).reduce(
        (total, action) => total + (action.kind === CardActionKind.ClaimMine ? action.regionalHunts : 0),
        0
    )
    const used = state.turnActionsTaken.filter((marker) => marker === ClaimHuntMarker).length
    return used < allowed
}

export function claimHuntRegions(state: HydratedRockyVenturesGameState, playerId: string, mineRegion: string | undefined): string[] {
    if (!claimHuntAvailable(state, playerId)) {
        return []
    }
    const huntable = huntableRegions(state)
    return [mineRegion, DragonHuntRegion].filter(
        (region): region is string => region !== undefined && huntable.includes(region)
    )
}

export function startClaimHunt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    region: string
) {
    if (!claimHuntAvailable(state, playerId) || !huntableRegions(state).includes(region)) {
        return
    }
    startHunt(state, playerId, region, ClaimHuntMarker)
}

export interface ResolveHuntRequest {
    tokenIndexes: number[]
    hitTargets: string[]
}

export function reasonResolveHuntInvalid(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    request: ResolveHuntRequest
): string | undefined {
    const pending = state.pendingHunt
    if (!pending) {
        return 'There is no hunt to resolve'
    }
    if (playerId !== currentPlayerId(state)) {
        return 'It is not your turn'
    }
    const unique = new Set(request.tokenIndexes)
    if (unique.size !== request.tokenIndexes.length) {
        return 'Choose each token only once'
    }
    if (request.tokenIndexes.some((index) => index < 0 || index >= pending.drawn.length)) {
        return 'That token was not drawn'
    }
    const most = Math.min(pending.apply, pending.drawn.length)
    if (pending.drawn.length > 0 && request.tokenIndexes.length < 1) {
        return 'Choose at least one token'
    }
    if (request.tokenIndexes.length > most) {
        return `You can apply at most ${most} token${most === 1 ? '' : 's'}`
    }
    const hits = request.tokenIndexes.filter((index) => pending.drawn[index] === WeaponTokenKind.Hit)
    if (hits.length !== request.hitTargets.length) {
        return 'Choose a target for every hit token'
    }
    const targets = huntTargets(state, pending.region).map((target) => target.id)
    if (request.hitTargets.some((target) => !targets.includes(target))) {
        return 'That target is not in the hunted region'
    }
    return undefined
}

function returnToBag(state: HydratedRockyVenturesGameState, kind: WeaponTokenKind, count = 1) {
    state.weaponBag[kind] = (state.weaponBag[kind] ?? 0) + count
}

function applyHit(state: HydratedRockyVenturesGameState, playerId: string, region: string, targetId: string) {
    const player = state.getPlayerState(playerId)
    if (region === DragonHuntRegion) {
        if (state.dragon.killed) {
            returnToBag(state, WeaponTokenKind.Hit)
            return
        }
        state.dragon.hits += 1
        player.victoryPoints += VictoryPointsPerHit
        recordVictoryPoints(state, playerId, VictoryPointsPerHit, 'hunt')
        if (state.dragon.hits >= DragonLevel) {
            state.dragon.killed = true
            returnToBag(state, WeaponTokenKind.Hit, DragonLevel)
        }
        return
    }
    const scourges = state.board.scourgesByRegion[region] ?? []
    const scourge = scourges.find((candidate) => candidate.scourgeId === targetId)
    if (!scourge) {
        returnToBag(state, WeaponTokenKind.Hit)
        return
    }
    scourge.hits += 1
    player.victoryPoints += VictoryPointsPerHit
    recordVictoryPoints(state, playerId, VictoryPointsPerHit, 'hunt')
    if (scourge.hits >= scourge.level) {
        state.board.scourgesByRegion[region] = scourges.filter(
            (candidate) => candidate.scourgeId !== targetId
        )
        state.removedScourges.push(scourge.scourgeId)
        returnToBag(state, WeaponTokenKind.Hit, scourge.level)
    }
}

function applyBonus(state: HydratedRockyVenturesGameState, playerId: string, kind: WeaponTokenKind) {
    const player = state.getPlayerState(playerId)
    state.dragon.trackerTokens.push(kind)
    if (state.dragon.trackerTokens.length >= BonusTokensToSummonDragon) {
        state.dragon.summoned = true
    }
    switch (kind) {
        case WeaponTokenKind.BonusGold:
            player.money += BonusGoldAmount
            recordCash(state, playerId, BonusGoldAmount, 'huntBonus')
            return
        case WeaponTokenKind.BonusWeaponLevel:
            advanceWeapon(state, playerId)
            return
        case WeaponTokenKind.BonusGem:
            if (player.weaponLevel >= BonusGemMinimumWeaponLevel) {
                recordGems(state, playerId, player.addGems(1), 'hunt')
            }
            return
        case WeaponTokenKind.BonusInvest:
            if (player.weaponLevel >= BonusInvestMinimumWeaponLevel) {
                state.bonusInvest = true
            }
            return
        default:
            return
    }
}

export function resolveHuntAt(
    state: HydratedRockyVenturesGameState,
    playerId: string,
    request: ResolveHuntRequest
) {
    const pending = state.pendingHunt
    if (!pending) {
        throw Error('There is no hunt to resolve')
    }
    const chosen = [...request.tokenIndexes]
    let hitIndex = 0
    for (const index of chosen) {
        const kind = pending.drawn[index]!
        if (kind === WeaponTokenKind.Hit) {
            applyHit(state, playerId, pending.region, request.hitTargets[hitIndex]!)
            hitIndex += 1
        } else if (kind === WeaponTokenKind.Miss) {
            continue
        } else {
            applyBonus(state, playerId, kind)
        }
    }
    pending.drawn.forEach((kind, index) => {
        if (!chosen.includes(index)) {
            returnToBag(state, kind)
        }
    })
    delete state.pendingHunt
}
