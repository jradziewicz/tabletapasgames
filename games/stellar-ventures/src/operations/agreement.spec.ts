import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CorporationId, CorporatePowerId } from '../model/corporation.js'
import { StellarVenturesGameInitializer } from '../definition/initializer.js'
import {
    AgreementTrackByPlanetCount,
    agreementTrackEntryForPlanetCount,
    alienPlanetOutpostCount,
    hasHiddenAlienAgreementTile,
    isEligibleToSignTheAgreement,
    isEligibleForSecretAgentsChoice,
    awardSecretAgentsMiningCapacityBonus,
    SECRET_AGENTS_MINING_CAPACITY_BONUS,
    meetsSignTheAgreementRequirements
} from './agreement.js'

// Real Alien Planet hexes on the Alpha map (data/alphaBoard.ts) - see
// stateHandlers/expandNetworkOrWormhole.spec.ts for the same fixed hex ids.
const ALIEN_PLANET_HEX_ID_1 = '6,0'
const ALIEN_PLANET_HEX_ID_2 = '1,1'
const NON_ALIEN_HEX_ID = '2,0' // Deep Space

function createTestGameState(playerCount = 4) {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))

    const game: Game = {
        id: 'game-1',
        typeId: 'stellar-ventures',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Stellar Ventures Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    return new StellarVenturesGameInitializer().initializeGameState(game, state)
}

describe('agreementTrackEntryForPlanetCount', () => {
    it('returns the printed Bonus Dividend / Agreement Bonus for 2, 3 and 4 Planets', () => {
        expect(agreementTrackEntryForPlanetCount(2)).toEqual(AgreementTrackByPlanetCount[2])
        expect(agreementTrackEntryForPlanetCount(3)).toEqual(AgreementTrackByPlanetCount[3])
        expect(agreementTrackEntryForPlanetCount(4)).toEqual(AgreementTrackByPlanetCount[4])
    })

    it('treats 5 or more Planets as the same "5+" section', () => {
        expect(agreementTrackEntryForPlanetCount(5)).toEqual(AgreementTrackByPlanetCount[5])
        expect(agreementTrackEntryForPlanetCount(7)).toEqual(AgreementTrackByPlanetCount[5])
    })

    it('clamps a below-minimum count up to the 2-Planet section', () => {
        expect(agreementTrackEntryForPlanetCount(0)).toEqual(AgreementTrackByPlanetCount[2])
        expect(agreementTrackEntryForPlanetCount(1)).toEqual(AgreementTrackByPlanetCount[2])
    })
})

describe('alienPlanetOutpostCount', () => {
    it("counts only Alien Planet hexes with this Corporation's Outpost", () => {
        const state = createTestGameState()
        expect(alienPlanetOutpostCount(state.board, CorporationId.PinkInc)).toBe(0)

        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        expect(alienPlanetOutpostCount(state.board, CorporationId.PinkInc)).toBe(1)

        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        expect(alienPlanetOutpostCount(state.board, CorporationId.PinkInc)).toBe(2)

        // A non-Alien-Planet Outpost doesn't count.
        state.board.buildOutpost(NON_ALIEN_HEX_ID, CorporationId.PinkInc)
        expect(alienPlanetOutpostCount(state.board, CorporationId.PinkInc)).toBe(2)
    })
})

describe('hasHiddenAlienAgreementTile', () => {
    it('is true for an Alien Planet hex until its tile is flipped', () => {
        const state = createTestGameState()
        expect(hasHiddenAlienAgreementTile(state.board, ALIEN_PLANET_HEX_ID_1)).toBe(true)

        state.board.requireHex(ALIEN_PLANET_HEX_ID_1).alienAgreementTileHidden = false
        expect(hasHiddenAlienAgreementTile(state.board, ALIEN_PLANET_HEX_ID_1)).toBe(false)
    })

    it('is false for a non-Alien-Planet hex', () => {
        const state = createTestGameState()
        expect(hasHiddenAlienAgreementTile(state.board, NON_ALIEN_HEX_ID)).toBe(false)
    })
})

describe('meetsSignTheAgreementRequirements', () => {
    it('requires Outposts on 2+ Alien Planets', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(false)

        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(false)

        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(true)
    })

    it('requires Alien Explorers to be Active', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        corporation.powers = corporation.powers.filter(
            (power) => power.id !== CorporatePowerId.AlienExplorers
        )
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(false)
    })

    it('requires 1+ Share available on the Charter', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        // PinkInc has 5 Shares total - issue all of them so none remain on the Charter.
        for (let i = 0; i < 5; i++) {
            corporation.issueShareToPlayer('p1', i)
        }
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(false)
    })

    it('is false once the Corporation has already signed', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        corporation.agreement = { planetCountAtSigning: 2 }
        expect(meetsSignTheAgreementRequirements(state.board, corporation)).toBe(false)
    })
})

describe('isEligibleToSignTheAgreement', () => {
    it('is false if the Corporation does not meet the requirements yet', () => {
        const state = createTestGameState()
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        // Only 1 Alien Planet Outpost so far - requirements not met.
        expect(
            isEligibleToSignTheAgreement(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_1)
        ).toBe(false)
    })

    it('is true only for a just-built hex that is an Alien Planet with a still-hidden tile', () => {
        const state = createTestGameState()
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        state.board.buildOutpost(NON_ALIEN_HEX_ID, CorporationId.PinkInc)

        expect(
            isEligibleToSignTheAgreement(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_2)
        ).toBe(true)
        expect(isEligibleToSignTheAgreement(state, CorporationId.PinkInc, NON_ALIEN_HEX_ID)).toBe(
            false
        )
    })

    it("is false once that hex's tile has already been flipped", () => {
        const state = createTestGameState()
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_2, CorporationId.PinkInc)
        state.board.requireHex(ALIEN_PLANET_HEX_ID_2).alienAgreementTileHidden = false

        expect(
            isEligibleToSignTheAgreement(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_2)
        ).toBe(false)
    })
})

describe('isEligibleForSecretAgentsChoice', () => {
    it('is false for a Corporation without Secret Agents active, even on an Alien Planet', () => {
        const state = createTestGameState()
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        // PinkInc holds Alien Explorers, not Secret Agents.
        expect(
            isEligibleForSecretAgentsChoice(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_1)
        ).toBe(false)
    })

    it('is false for a non-Alien-Planet hex, even with Secret Agents active', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers.push({ id: CorporatePowerId.SecretAgents })
        state.board.buildOutpost(NON_ALIEN_HEX_ID, CorporationId.PinkInc)
        expect(
            isEligibleForSecretAgentsChoice(state, CorporationId.PinkInc, NON_ALIEN_HEX_ID)
        ).toBe(false)
    })

    it('is true for a Secret Agents Corporation building on an Alien Planet, tile hidden or not', () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        corporation.powers.push({ id: CorporatePowerId.SecretAgents })
        state.board.buildOutpost(ALIEN_PLANET_HEX_ID_1, CorporationId.PinkInc)
        expect(
            isEligibleForSecretAgentsChoice(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_1)
        ).toBe(true)

        // Unlike Sign The Agreement, this doesn't require any minimum Alien Planet count or
        // Share availability, and stays true even once the tile is already used up - it's the
        // caller's job (hasHiddenAlienAgreementTile) to tell a real choice apart from the
        // auto-resolved "no tile left" case.
        state.board.requireHex(ALIEN_PLANET_HEX_ID_1).alienAgreementTileRemoved = true
        expect(
            isEligibleForSecretAgentsChoice(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_1)
        ).toBe(true)
    })
})

describe('awardSecretAgentsMiningCapacityBonus', () => {
    it("permanently increases the Corporation's own Mining Capacity by 3 and discards the tile", () => {
        const state = createTestGameState()
        const corporation = state.getCorporation(CorporationId.PinkInc)
        expect(corporation.secretAgentsMiningCapacityBonus ?? 0).toBe(0)

        awardSecretAgentsMiningCapacityBonus(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_1)
        expect(corporation.secretAgentsMiningCapacityBonus).toBe(
            SECRET_AGENTS_MINING_CAPACITY_BONUS
        )
        expect(state.board.requireHex(ALIEN_PLANET_HEX_ID_1).alienAgreementTileRemoved).toBe(true)

        // Accumulates across multiple Alien Planets rather than being a flat, always-on bonus.
        awardSecretAgentsMiningCapacityBonus(state, CorporationId.PinkInc, ALIEN_PLANET_HEX_ID_2)
        expect(corporation.secretAgentsMiningCapacityBonus).toBe(
            SECRET_AGENTS_MINING_CAPACITY_BONUS * 2
        )
    })
})
