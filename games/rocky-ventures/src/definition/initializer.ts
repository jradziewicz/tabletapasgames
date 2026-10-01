import {
    type GameInitializer,
    BaseGameInitializer,
    Prng,
    type UninitializedGameState,
    Game,
    Player,
    HydratedTurnManager,
    shuffle
} from '@tabletop/common'
import { DummyPlayerCount } from '../model/dummy.js'
import { HydratedRockyVenturesGameState, RockyVenturesGameState } from '../model/gameState.js'
import { HydratedRockyVenturesPlayerState, RockyVenturesPlayerState } from '../model/playerState.js'
import type { CompanyState } from '../model/company.js'
import type { BoardState, MineSite } from '../model/board.js'
import { MachineState } from './states.js'
import { RockyVenturesColors } from './colors.js'
import {
    BoardEdges,
    BoxKind,
    DeliveryCityId,
    DornochDurNodeId,
    MineNodeIds
} from '../data/board.js'
import { CompanyId, CompanyIds } from '../data/companies.js'
import { RegionId, RegionIds } from '../data/regions.js'
import {
    GoldATokens,
    GoldBTokens,
    MineTier,
    OreKind,
    SilverATokens,
    SilverBTokens
} from '../data/mineTokens.js'
import { ScourgeDefinitions } from '../data/scourges.js'
import { StartingWeaponBag } from '../data/weaponBag.js'
import { AgreementLetters } from '../data/agreements.js'
import { EndOfEraCards, GameOverCard, PlayerCardIds, developmentCardIdsForDecade } from '../data/cards.js'
import {
    DornochDurStartingMineLevel,
    MarketSize,
    StartingClaimTokens,
    StartingCompanyTreasury,
    StartingGems,
    StartingMoney,
    StartingToolLevel,
    StartingVictoryPoints,
    StartingWeaponLevel
} from '../data/setup.js'
import { addScourgeToRegion } from '../operations/scourges.js'
import { takeSpecificMineToken } from '../operations/mines.js'
import { drawIntoMarket } from '../operations/market.js'

// Setup step 5 (draft rulebook): one level 1 scourge in Gold Valley and one in Manor's Gate.
const StartingScourgeRegions: RegionId[] = [RegionId.GoldValley, RegionId.ManorsGate]

export class RockyVenturesGameInitializer
    extends BaseGameInitializer<RockyVenturesGameState, HydratedRockyVenturesGameState>
    implements GameInitializer<RockyVenturesGameState, HydratedRockyVenturesGameState>
{
    initializeGameState(game: Game, state: UninitializedGameState): HydratedRockyVenturesGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        const orderedPlayers: RockyVenturesPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((candidate) => candidate.playerId === playerId)
            if (player) {
                // First to act starts with $15, each later seat $1 more (Justin, 2026-10-01).
                // The 2-player dummy keeps its own ruled $15.
                player.money = StartingMoney + orderedPlayers.length
                orderedPlayers.push(player)
            }
        }

        const rockyVenturesGameState: RockyVenturesGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.MovePawn,
            turnManager,
            board: this.initializeBoard(),
            companies: this.initializeCompanies(),
            market: { drawPile: this.buildDrawPile(prng), slots: [] },
            mineSupplies: this.initializeMineSupplies(prng),
            scourgeDeck: ScourgeDefinitions.map((scourge) => scourge.id),
            removedScourges: [],
            weaponBag: { ...StartingWeaponBag },
            dragon: { trackerTokens: [], summoned: false, hits: 0, killed: false },
            agreementStacks: this.initializeAgreementStacks(prng),
            gemsSpent: 0,
            era: 1,
            turnActionsTaken: [],
            turnTrackCompanies: [],
            turnOver: false,
            statEvents: []
        })

        const hydratedState = new HydratedRockyVenturesGameState(rockyVenturesGameState)
        if (game.players.length === DummyPlayerCount) {
            hydratedState.dummy = {
                money: StartingMoney,
                victoryPoints: StartingVictoryPoints,
                weaponLevel: StartingWeaponLevel,
                toolLevel: StartingToolLevel,
                tuckedCardIds: [],
                nextAction: 'tax',
                nextBump: 'weapon'
            }
        }
        this.placeDornochDurMine(hydratedState)
        for (const region of StartingScourgeRegions) {
            addScourgeToRegion(hydratedState, region, prng.random)
        }
        for (let slot = 0; slot < MarketSize; slot += 1) {
            drawIntoMarket(hydratedState, prng.random)
        }
        return hydratedState
    }

    private initializePlayers(game: Game, prng: Prng): RockyVenturesPlayerState[] {
        const colors = structuredClone(RockyVenturesColors)
        shuffle(colors, prng.random)

        return game.players.map((player: Player, index: number) => {
            return new HydratedRockyVenturesPlayerState({
                playerId: player.id,
                color: colors[index]!,
                money: StartingMoney,
                gems: StartingGems,
                claimTokens: StartingClaimTokens,
                victoryPoints: StartingVictoryPoints,
                weaponLevel: StartingWeaponLevel,
                toolLevel: StartingToolLevel,
                redMinesUnlocked: false,
                blueMinesUnlocked: false,
                tableau: [...PlayerCardIds],
                tuckedCardIds: [],
                shares: [],
                agreements: []
            })
        })
    }

    private initializeBoard(): BoardState {
        const mines: Record<string, MineSite> = Object.fromEntries(
            MineNodeIds.map((nodeId) => [nodeId, { nodeId }])
        )
        const trackByBoxId: Record<string, CompanyId> = {}
        for (const edge of BoardEdges) {
            for (const box of edge.boxes) {
                if (box.kind === BoxKind.Start && box.startingCompanyId) {
                    trackByBoxId[box.id] = box.startingCompanyId
                }
            }
        }
        const scourgesByRegion = Object.fromEntries(RegionIds.map((region) => [region, []]))
        return { mines, trackByBoxId, scourgesByRegion }
    }

    private initializeCompanies(): CompanyState[] {
        return CompanyIds.map((id) => ({
            id,
            treasury: StartingCompanyTreasury,
            cubesOnMap: 1,
            deliveredMineTokenIds: [],
            nextShareIndex: 0,
            sharesFlipped: false,
            connectedToDornochDur: false
        }))
    }

    private initializeMineSupplies(prng: Prng) {
        const goldA = [...GoldATokens]
        const goldB = [...GoldBTokens]
        const silverA = [...SilverATokens]
        const silverB = [...SilverBTokens]
        shuffle(goldA, prng.random)
        shuffle(goldB, prng.random)
        shuffle(silverA, prng.random)
        shuffle(silverB, prng.random)
        return { goldA, goldB, silverA, silverB }
    }

    private initializeAgreementStacks(prng: Prng): Record<string, typeof AgreementLetters> {
        const stacks: Record<string, typeof AgreementLetters> = {}
        for (const cityId of [DeliveryCityId.Dornoch, DeliveryCityId.Manor]) {
            const letters = [...AgreementLetters]
            shuffle(letters, prng.random)
            stacks[cityId] = letters
        }
        return stacks
    }

    // Decade 1 on top, then Decade 2 with End of Era I shuffled in, Decade 3 with End of Era II,
    // Decade 4, and the Game Over card face up at the bottom.
    private buildDrawPile(prng: Prng): string[] {
        const decade1 = developmentCardIdsForDecade(1)
        const decade2 = [...developmentCardIdsForDecade(2), EndOfEraCards[0]!.id]
        const decade3 = [...developmentCardIdsForDecade(3), EndOfEraCards[1]!.id]
        const decade4 = developmentCardIdsForDecade(4)
        for (const decade of [decade1, decade2, decade3, decade4]) {
            shuffle(decade, prng.random)
        }
        return [...decade1, ...decade2, ...decade3, ...decade4, GameOverCard.id]
    }

    private placeDornochDurMine(state: HydratedRockyVenturesGameState) {
        const token = takeSpecificMineToken(
            state,
            OreKind.Gold,
            MineTier.B,
            (candidate) => candidate.level === DornochDurStartingMineLevel && !candidate.scourge
        )
        state.board.getMine(DornochDurNodeId).token = token
    }
}
