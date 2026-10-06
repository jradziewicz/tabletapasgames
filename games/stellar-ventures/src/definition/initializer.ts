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
import { HydratedStellarVenturesGameState, StellarVenturesGameState } from '../model/gameState.js'
import {
    HydratedStellarVenturesPlayerState,
    StellarVenturesPlayerState
} from '../model/playerState.js'
import {
    CorporationId,
    CorporationState,
    CorporatePowerId,
    OutpostSupplyByCorporationId,
    StartingCorporationIds
} from '../model/corporation.js'
import { BoardState, Hex, HexType, hexIdForCoordinate } from '../model/board.js'
import { ShipLevels, ShipyardState } from '../model/shipyard.js'
import { BoardMapDefinitions } from '../data/boardMaps.js'
import {
    CORPORATE_POWER_DRAW_PILE_COUNT,
    INITIAL_AVAILABLE_CORPORATE_POWER_COUNT,
    NeutralCorporatePowerIds
} from '../operations/corporatePowers.js'

import { MachineState } from './states.js'
import {
    BoardMap,
    Difficulty,
    StartingAlienMiningCapacityByDifficulty,
    StellarVenturesGameConfig
} from './config.js'
import { StellarVenturesColors } from './colors.js'

// Confirmed rulebook Setup values.
const STARTING_FUNDS_POOL = 120 // Each player starts with STARTING_FUNDS_POOL / player count.
// Setup step 16.e (rulebook page 3): "6 Boardroom Votes" per player.
const STARTING_BOARDROOM_VOTES = 6
// Confirmed by the game's co-designer: each player also starts with 1 Alien Technology Cube.
const STARTING_ALIEN_TECH_CUBES = 1
const SHARES_FOR_CORPORATION: Record<CorporationId, number> = {
    [CorporationId.PinkInc]: 5,
    [CorporationId.FrostFederated]: 5,
    [CorporationId.ScarletSyndicate]: 5,
    [CorporationId.CeruleanCouncil]: 5,
    [CorporationId.GambogeGuild]: 5,
    [CorporationId.AmethystAgency]: 3
}
// Starting ship counts by shipyard level, confirmed directly from the Alpha board's printed
// Shipyard track. Level 8 prints an infinity symbol rather than a count - see `unlimited` below.
const STARTING_SHIP_COUNTS_BY_LEVEL: Record<number, number> = {
    1: 9,
    2: 7,
    3: 9,
    5: 5,
    8: 0
}
// Confirmed directly from the Alpha map board's printed Shipyard track (far top-left): Level 3's
// header shows a Scrapping Event icon targeting Level 1; Level 5's targets Level 2; Level 8's
// targets Level 3. Levels 1 and 2 have no Scrapping Event of their own.
const ScrapTargetLevelByLevel: Record<number, number | undefined> = {
    3: 1,
    5: 2,
    8: 3
}
// The 5 physical Alien Shipyard Tiles' chevron counts, confirmed from SV_PUNCHBOARD_FINAL.pdf
// (page 5, chevron side): 3, 2, 1, 1, 0. Setup step 7 (rulebook page 3): shuffle all 5 and place
// 1 face-down on each of the Shipyard's 3 tile hexes (3 on Alpha - see the printed Shipyard
// track), returning the other 2 to the box unseen.
export const ALIEN_SHIPYARD_TILE_CHEVRONS = [3, 2, 1, 1, 0]
// The 3 Shipyard levels that have a tile hex on the Alpha map, confirmed from the board's
// printed Shipyard track (a green hex slot follows each of these levels' columns).
const ALIEN_SHIPYARD_TILE_LEVELS = [2, 3, 5]
// The 10 physical Alien Agreement Tiles' chevron counts, confirmed from SV_PUNCHBOARD_FINAL.pdf
// (pages 1 and 3, chevron side): 0, 1, 1, 1, 2, 2, 2, 2, 3, 4. Setup step 6 (rulebook page 3):
// shuffle all 10 face-down and place 1 on each Alien Planet hex (7 on Alpha), returning the
// other 3 to the box unseen. ("First Play: Tile with 4 chevrons should not be used" isn't
// modeled as a special mode, consistent with how the Alien Shipyard Tiles' own "First Play" note
// above is also not specially handled.)
export const ALIEN_AGREEMENT_TILE_CHEVRONS = [0, 1, 1, 1, 2, 2, 2, 2, 3, 4]

// Confirmed directly from the rulebook's own "New Investor Setup" diagrams (pages 26-27),
// which give a complete alternate Setup for 3, 4 and 5 players (New Investor Setup has no
// diagram for 2 or 6+ players). Each of the 5 starting Corporations (Amethyst Agency isn't
// part of this either - it isn't formed until Era 3) begins already holding a second Corporate
// Power on top of every Corporation's base Alien Explorers, plus a non-zero Treasury -
// simulating what a completed Initial Auction would have produced. Both vary by player count:
// Pink Inc and Gamboge Guild swap which of the two they hold in the 5-player diagram versus the
// 3-and-4-player ones, and Cerulean Council's and Scarlet Syndicate's Treasuries also shift
// slightly between counts. See applyNewInvestorSetup below for how each player's own starting
// Liquid Funds are derived from this table rather than being a separate hardcoded number - the
// diagrams themselves never show a "remaining funds" table, only how many Credits sit in each
// player's Liquid Funds pile in the example art, so the actual rule this table encodes is:
// every player still starts from the same STARTING_FUNDS_POOL / playerCount baseline as
// standard Setup, minus whatever Treasury total ends up "spent" on the Corporation(s) that
// player becomes President of. That rule was verified against all three diagrams by
// conservation: for every player count, the sum of these 5 Treasuries plus every player's
// resulting Liquid Funds equals exactly STARTING_FUNDS_POOL (120) - confirming both the
// Treasury numbers below and the funds rule itself, since the diagrams can only be
// redistributing the same fixed pool, never creating or destroying Credits.
interface NewInvestorSetupCorporationValues {
    treasury: number
    secondPowerId: CorporatePowerId
}
const NEW_INVESTOR_SETUP_BY_PLAYER_COUNT: Record<
    number,
    Partial<Record<CorporationId, NewInvestorSetupCorporationValues>>
> = {
    3: {
        [CorporationId.CeruleanCouncil]: { treasury: 12, secondPowerId: CorporatePowerId.Hyperdrive },
        [CorporationId.PinkInc]: { treasury: 7, secondPowerId: CorporatePowerId.AlienAlchemist },
        [CorporationId.GambogeGuild]: { treasury: 13, secondPowerId: CorporatePowerId.IcarusExperiment },
        [CorporationId.FrostFederated]: { treasury: 10, secondPowerId: CorporatePowerId.OreRefinement },
        [CorporationId.ScarletSyndicate]: { treasury: 22, secondPowerId: CorporatePowerId.LeakedResearch }
    },
    4: {
        [CorporationId.CeruleanCouncil]: { treasury: 13, secondPowerId: CorporatePowerId.Hyperdrive },
        [CorporationId.PinkInc]: { treasury: 7, secondPowerId: CorporatePowerId.AlienAlchemist },
        [CorporationId.GambogeGuild]: { treasury: 13, secondPowerId: CorporatePowerId.IcarusExperiment },
        [CorporationId.FrostFederated]: { treasury: 10, secondPowerId: CorporatePowerId.OreRefinement },
        [CorporationId.ScarletSyndicate]: { treasury: 22, secondPowerId: CorporatePowerId.LeakedResearch }
    },
    5: {
        [CorporationId.CeruleanCouncil]: { treasury: 13, secondPowerId: CorporatePowerId.Hyperdrive },
        [CorporationId.PinkInc]: { treasury: 7, secondPowerId: CorporatePowerId.IcarusExperiment },
        [CorporationId.GambogeGuild]: { treasury: 13, secondPowerId: CorporatePowerId.AlienAlchemist },
        [CorporationId.FrostFederated]: { treasury: 10, secondPowerId: CorporatePowerId.OreRefinement },
        [CorporationId.ScarletSyndicate]: { treasury: 16, secondPowerId: CorporatePowerId.LeakedResearch }
    }
}
// The 5 physical Corporate Power tiles handed directly to Charters above - derived from the
// table itself (rather than a second hardcoded list) so the two can never drift apart. Every
// player count's table uses the same 5 tiles (only which Corporation gets which one changes),
// so any one count's values will do.
const NEW_INVESTOR_SETUP_ASSIGNED_POWER_IDS: CorporatePowerId[] = Object.values(
    NEW_INVESTOR_SETUP_BY_PLAYER_COUNT[3]!
).map((entry) => entry.secondPowerId)

// Which Corporation(s) each Player (by seating index - Player A is index 0, clockwise from
// there, per the rulebook's own "Assign Players" step) becomes President of - read directly off
// each player circle's Share Certificate colors in the rulebook's own diagrams, NOT a round-robin
// formula. It has to be read off the art rather than computed: which two Corporations end up
// paired together on the one player who gets two isn't the same from one player count to the
// next (3-player pairs Frost Federated with Gamboge Guild; 4-player splits that same pair across
// two different players instead), so there's no single fixed Corporation order whose plain
// index-modulo-player-count reproduces every count's actual diagram at once - each player count's
// pairing is its own confirmed fact, not a derived one.
const NEW_INVESTOR_SETUP_PRESIDENTS_BY_PLAYER_COUNT: Record<number, CorporationId[][]> = {
    3: [
        [CorporationId.PinkInc, CorporationId.CeruleanCouncil],
        [CorporationId.FrostFederated, CorporationId.GambogeGuild],
        [CorporationId.ScarletSyndicate]
    ],
    4: [
        [CorporationId.PinkInc, CorporationId.CeruleanCouncil],
        [CorporationId.GambogeGuild],
        [CorporationId.FrostFederated],
        [CorporationId.ScarletSyndicate]
    ],
    5: [
        [CorporationId.PinkInc],
        [CorporationId.CeruleanCouncil],
        [CorporationId.GambogeGuild],
        [CorporationId.FrostFederated],
        [CorporationId.ScarletSyndicate]
    ]
}

// This class is responsible for initializing a new Stellar Ventures game, including setting up
// the initial game state and player states
export class StellarVenturesGameInitializer
    extends BaseGameInitializer<StellarVenturesGameState, HydratedStellarVenturesGameState>
    implements GameInitializer<StellarVenturesGameState, HydratedStellarVenturesGameState>
{
    // Initialize the game state based on things like the number of players and the game config
    initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedStellarVenturesGameState {
        // Initialize a pseudo random number generator for the state
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)

        // Every game state has a turn manager to track whose turn it is
        const turnManager = HydratedTurnManager.generate(players, prng.random)

        // Put players array in our randomly generated turn order
        const orderedPlayers: StellarVenturesPlayerState[] = []
        for (const playerId of turnManager.turnOrder) {
            const player = players.find((p) => p.playerId === playerId)
            if (player) {
                orderedPlayers.push(player)
            }
        }

        const config = game.config as StellarVenturesGameConfig
        const difficulty = config.difficulty ?? Difficulty.Friendly
        const boardMap = config.boardMap ?? BoardMap.Alpha
        const boardMapDefinition = BoardMapDefinitions[boardMap]

        // Corporations are auctioned off in a random order during Setup's Initial Auction.
        const corporationAuctionOrder = [...StartingCorporationIds]
        shuffle(corporationAuctionOrder, prng.random)

        // Setup step 9 (rulebook page 3): each of the 5 starting Corporations begins with one
        // Outpost on its own Home Planet. Amethyst Agency doesn't enter until Era 3 and has 3
        // candidate Home Planets to choose from (see AmethystCandidateHomeHexIds), so it's
        // excluded here.
        const homePlanetHexIdByCorporation = new Map<CorporationId, string>()
        for (const hex of boardMapDefinition.hexes) {
            if (
                hex.homeCorporationId &&
                StartingCorporationIds.includes(hex.homeCorporationId) &&
                !homePlanetHexIdByCorporation.has(hex.homeCorporationId)
            ) {
                homePlanetHexIdByCorporation.set(hex.homeCorporationId, hex.id)
            }
        }

        // Amethyst Agency has a CorporationState from the very start (inactive - see
        // initializeCorporations below), even though it doesn't join corporationTurnOrder or take
        // any turns until FormAmethystAgencyStateHandler activates it at the start of Era 3.
        const corporations = this.initializeCorporations(
            [...corporationAuctionOrder, CorporationId.AmethystAgency],
            homePlanetHexIdByCorporation
        )

        // Setup step 6 (rulebook page 3): shuffle the 10 Alien Agreement Tiles and deal 1
        // face-down to each of the 7 Alien Planet hexes on Alpha, returning the other 3 to the
        // box unseen. Unlike the Alien Shipyard Tiles (whose chevrons stay hidden inside
        // shipyard.sections until first revealed), each Alien Planet hex's chevron count is
        // known internally from Setup onward via alienAgreementTileChevrons -
        // alienAgreementTileHidden is what actually tracks whether it's been revealed yet.
        const alienPlanetHexIds = boardMapDefinition.hexes.filter((hex) => hex.type === HexType.AlienPlanet).map(
            (hex) => hex.id
        )
        const shuffledAlienAgreementTileChevrons = [...ALIEN_AGREEMENT_TILE_CHEVRONS]
        shuffle(shuffledAlienAgreementTileChevrons, prng.random)
        const alienAgreementTileChevronsByHexId = new Map<string, number>(
            alienPlanetHexIds.map((hexId, index) => [hexId, shuffledAlienAgreementTileChevrons[index]!])
        )
        // The remaining 3 (10 tiles - 7 Alien Planet hexes), already shuffled above - Nebular
        // Explorers draws from the front of this array (see model/gameState.ts).
        const unusedAlienAgreementTileChevrons = shuffledAlienAgreementTileChevrons.slice(
            alienPlanetHexIds.length
        )

        // Transcribed from the Alpha map board (SV_BOARD_ALPHA_FINAL) - see
        // src/data/alphaBoard.ts for the flagged assumptions made while digitizing it (still
        // pending a spot-check against the physical board).
        //
        // Each hex is cloned (including its own outposts array) rather than reusing the
        // AlphaBoardHexes objects directly - those are a shared module-level constant, and
        // mutating them in place (as buildOutpost does) would leak Outposts from one game into
        // every other game's board for the rest of the process.
        const board: BoardState = {
            hexes: Object.fromEntries(
                boardMapDefinition.hexes.map((hex): [string, Hex] => {
                    const outposts = [...hex.outposts]
                    if (
                        hex.homeCorporationId &&
                        homePlanetHexIdByCorporation.get(hex.homeCorporationId) === hex.id
                    ) {
                        outposts.push(hex.homeCorporationId)
                    }
                    const agreementTileChevrons = alienAgreementTileChevronsByHexId.get(hex.id)
                    const agreementTileFields =
                        agreementTileChevrons !== undefined
                            ? {
                                  alienAgreementTileHidden: true,
                                  alienAgreementTileChevrons: agreementTileChevrons
                              }
                            : {}
                    return [
                        hexIdForCoordinate(hex.coordinate),
                        { ...hex, outposts, ...agreementTileFields }
                    ]
                })
            ),
            megaEarth: { valueTrack: [...boardMapDefinition.megaEarthValueTrack], fillOrder: [] },
            ...(boardMapDefinition.miniEarthValueTrack
                ? { miniEarth: { valueTrack: [...boardMapDefinition.miniEarthValueTrack], fillOrder: [] } }
                : {}),
            ...(boardMapDefinition.borders.length > 0 ? { closedBorderLevels: [] } : {})
        }

        // Setup step 7: shuffle the 5 Alien Shipyard Tiles and deal 3 to the Shipyard's 3 tile
        // hexes (Levels 2, 3 and 5 on Alpha). Their chevron counts stay hidden in this dealt
        // order until each section's first Ship is Ordered - see resolveFirstShipOrderedEffects.
        const shuffledAlienShipyardTileChevrons = [...ALIEN_SHIPYARD_TILE_CHEVRONS]
        shuffle(shuffledAlienShipyardTileChevrons, prng.random)
        const alienTileChevronsByLevel = new Map<number, number>(
            ALIEN_SHIPYARD_TILE_LEVELS.map((level, index) => [
                level,
                shuffledAlienShipyardTileChevrons[index]!
            ])
        )

        const shipyard: ShipyardState = {
            sections: ShipLevels.map((level) => ({
                level,
                remainingShips: STARTING_SHIP_COUNTS_BY_LEVEL[level] ?? 0,
                unlimited: level === 8,
                // Confirmed directly from the Alpha board's printed Shipyard track: Levels 3, 5
                // and 8 each show a Scrapping Event icon naming the lower level it scraps.
                scrapTargetLevel: ScrapTargetLevelByLevel[level],
                alienTileChevrons: alienTileChevronsByLevel.get(level)
            }))
        }

        const skipInitialAuction = config.useNewInvestorSetup === true

        // Setup step 17 (rulebook page 6): shuffle all 18 Neutral Corporate Power tiles, but only
        // 11 of them are used this game - the other 7 are left out entirely, matching "make a
        // draw pile of 11... return the remaining to the game box." Of those 11, 6 go into the
        // visible row (state.availableCorporatePowerIds) and the other 5 stay hidden in a draw
        // pile (state.corporatePowerDrawPileIds) - see operations/corporatePowers.ts. New Investor
        // Setup hands 5 specific physical tiles directly to Charters instead (see
        // NEW_INVESTOR_SETUP_BY_PLAYER_COUNT above) - those 5 have to come out of this shuffle
        // pool first, or the same physical tile could end up on a Charter AND in the visible row
        // or draw pile at once. Those 5 also count toward the 11 tiles used this game, so New
        // Investor Setup leaves 6 face up and no hidden draw pile - the same 6 a standard game
        // shows once its Initial Auction drafts are done. (Dealing a full 6 + 5 on top of the 5
        // assigned tiles put 16 Powers into play and grew the row to 10 after the first Sign The
        // Agreement draft.)
        const corporatePowerPool = skipInitialAuction
            ? NeutralCorporatePowerIds.filter((id) => !NEW_INVESTOR_SETUP_ASSIGNED_POWER_IDS.includes(id))
            : NeutralCorporatePowerIds
        const shuffledCorporatePowerIds = [...corporatePowerPool]
        shuffle(shuffledCorporatePowerIds, prng.random)
        const availableCorporatePowerIds = shuffledCorporatePowerIds.slice(
            0,
            INITIAL_AVAILABLE_CORPORATE_POWER_COUNT
        )
        const corporatePowerDrawPileIds = skipInitialAuction
            ? []
            : shuffledCorporatePowerIds.slice(
                  INITIAL_AVAILABLE_CORPORATE_POWER_COUNT,
                  INITIAL_AVAILABLE_CORPORATE_POWER_COUNT + CORPORATE_POWER_DRAW_PILE_COUNT
              )

        // Confirmed by the game's co-designer: the Corporation Round's turn order should run in
        // the OPPOSITE order from the Initial Auction queue, not the same order. Whichever
        // Corporation is auctioned off first also gets to draft its second Corporate Power
        // first (see stateHandlers/initialAuction.ts) - as a balancing tradeoff for that early
        // pick, it should be the LAST Corporation to actually take a turn once the Corporation
        // Round begins. This only applies to the standard auction-based Setup - New Investor
        // Setup (skipInitialAuction) never runs an auction or a power draft at all, so there's
        // no first-pick advantage there to balance. Instead, per the game's designer, Pink Inc.
        // always operates first in a New Investor game, and the other 4 follow in random order
        // (the same shuffle, with Pink Inc. pulled to the front).
        const corporationRoundTurnOrder = skipInitialAuction
            ? [
                  CorporationId.PinkInc,
                  ...corporationAuctionOrder.filter((id) => id !== CorporationId.PinkInc)
              ]
            : [...corporationAuctionOrder].reverse()

        const stellarVenturesGameState: StellarVenturesGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: skipInitialAuction ? MachineState.IssueShare : MachineState.InitialAuction,
            turnManager: turnManager,
            difficulty,
            ...(boardMap === BoardMap.Alpha ? {} : { boardMap }),
            ...(boardMapDefinition.borders.length > 0 ? { taxBox: 0 } : {}),
            era: 1,
            corporations,
            corporationTurnOrder: corporationRoundTurnOrder,
            activeCorporationIndex: 0,
            board,
            shipyard,
            alienCorporation: {
                miningCapacity: StartingAlienMiningCapacityByDifficulty[difficulty]
            },
            // The starting Director is not yet confirmed against the rulebook's Setup steps;
            // defaulting to the first player in (randomly generated) turn order for now.
            directorPlayerId: turnManager.turnOrder[0],
            availableCorporatePowerIds,
            corporatePowerDrawPileIds,
            unusedAlienAgreementTileChevrons,
            alienAlchemistUsedThisCorporationRound: false,
            dismantlingOutpostsUsedThisCorporationRound: false,
            // A separate copy from corporationTurnOrder, since this queue gets consumed
            // (shifted) as the Initial Auction proceeds.
            initialAuctionQueue: skipInitialAuction ? [] : [...corporationAuctionOrder]
        })

        // I suppose the engine could actually do the hydration with the hydrator, but this is how
        // it is done currently.
        const hydratedState = new HydratedStellarVenturesGameState(stellarVenturesGameState)

        if (skipInitialAuction) {
            this.applyNewInvestorSetup(hydratedState)
        }

        return hydratedState
    }

    // Initialize player states for all players in the game
    private initializePlayers(game: Game, prng: Prng): StellarVenturesPlayerState[] {
        // Assign colors randomly to players
        const colors = structuredClone(StellarVenturesColors)
        shuffle(colors, prng.random)

        const startingLiquidFunds = Math.floor(STARTING_FUNDS_POOL / game.players.length)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedStellarVenturesPlayerState({
                playerId: player.id,
                color: colors[index],
                liquidFunds: startingLiquidFunds,
                frozenFunds: 0,
                boardroomVotes: STARTING_BOARDROOM_VOTES,
                alienTechCubes: STARTING_ALIEN_TECH_CUBES
            })
        })

        return players
    }

    private initializeCorporations(
        corporationIds: CorporationId[],
        homePlanetHexIdByCorporation: Map<CorporationId, string>
    ): CorporationState[] {
        return corporationIds.map((id, index) => ({
            id,
            // Amethyst Agency sits out until it's formed at the start of Era 3 (rulebook page 9)
            // - see operations/boardroomBattle.ts's eligibleBoardroomBattleCorporationIds, which
            // relies on this flag to exclude it from Boardroom Battle until then.
            active: id !== CorporationId.AmethystAgency,
            treasury: 0,
            shares: Array.from({ length: SHARES_FOR_CORPORATION[id] }, () => ({})),
            homePlanetId: homePlanetHexIdByCorporation.get(id),
            cargo: 0,
            orderedShipLevels: [],
            deliveredShipLevels: [],
            // Confirmed by the game's co-designer: Amethyst Agency begins with Wormhole
            // Technology Active from Setup itself (rulebook page 3: "Place an Alien Technology
            // Cube on 'Wormhole'"; page 9 repeats this as a reminder) - unlike every other
            // Corporation, which starts inactive and earns it via the Create Wormhole action.
            wormholeActive: id === CorporationId.AmethystAgency,
            // Setup step 15b (rulebook page 3): every starting Corporation's Charter begins with
            // the "Alien Explorers" Corporate Power active. Amethyst Agency instead begins with
            // no Powers here - it's granted "Secret Agents" once formed in Era 3 (rulebook page
            // 9's Formation Power; Amethyst Agency FAQ, page 23) - see
            // actions/chooseAmethystHomePlanet.ts.
            powers: id === CorporationId.AmethystAgency ? [] : [{ id: CorporatePowerId.AlienExplorers }],
            loanCount: 0,
            turnOrderPosition: index,
            // OutpostSupplyByCorporationId is this Corporation's ENTIRE physical Outpost supply -
            // the 5 starting Corporations already placed 1 (their Home Planet Outpost, above) at
            // Setup, so 1 is already out of the box; Amethyst Agency's own Home Planet Outpost
            // isn't placed until Formation (actions/chooseAmethystHomePlanet.ts, which decrements
            // this the same way every other build does - see
            // operations/network.ts's buildOutpostForCorporation), so it starts at its full supply.
            unbuiltOutposts:
                OutpostSupplyByCorporationId[id] - (homePlanetHexIdByCorporation.has(id) ? 1 : 0)
        }))
    }

    // Used only when the "New Investor Setup" config option skips the Initial Auction -
    // assigns each Corporation's first President automatically in turn order instead.
    private assignPresidentsWithoutAuction(state: HydratedStellarVenturesGameState) {
        const playerIds = state.turnManager.turnOrder
        // Amethyst Agency isn't part of this - it has no President until it's formed in Era 3.
        const startingCorporations = state.corporations.filter((corporation) => corporation.active)
        startingCorporations.forEach((corporation, index) => {
            const presidentPlayerId = playerIds[index % playerIds.length]
            if (presidentPlayerId) {
                corporation.issueShareToPlayer(presidentPlayerId, index)
            }
        })
    }

    // New Investor Setup's real Presidential assignment - see NEW_INVESTOR_SETUP_BY_PLAYER_COUNT
    // above for where this data comes from. Same round-robin order as
    // assignPresidentsWithoutAuction (which this falls back to for a player count the rulebook's
    // New Investor Setup diagrams don't cover), but this version also gives each starting
    // Corporation its rulebook-confirmed Treasury and second Corporate Power, and derives every
    // player's own starting Liquid Funds from those Treasuries rather than a flat per-player
    // split - see the big comment on NEW_INVESTOR_SETUP_BY_PLAYER_COUNT for why that derivation
    // (baseline per-player share of STARTING_FUNDS_POOL, minus whatever Treasury total ends up on
    // the Corporation(s) that player presides over) is the rule the diagrams actually encode.
    private applyNewInvestorSetup(state: HydratedStellarVenturesGameState) {
        const playerIds = state.turnManager.turnOrder
        const setupByCorp = NEW_INVESTOR_SETUP_BY_PLAYER_COUNT[playerIds.length]
        const presidentsByPlayerIndex = NEW_INVESTOR_SETUP_PRESIDENTS_BY_PLAYER_COUNT[playerIds.length]
        if (!setupByCorp || !presidentsByPlayerIndex) {
            // No confirmed rulebook diagram for this player count (New Investor Setup is only
            // published for 3-5 players) - fall back to the plain round-robin President
            // assignment with every Corporation's Treasury/Powers left at their normal Setup
            // defaults, rather than throwing and blocking the game from starting.
            this.assignPresidentsWithoutAuction(state)
            return
        }

        // Which player (by seating index, per NEW_INVESTOR_SETUP_PRESIDENTS_BY_PLAYER_COUNT)
        // presides over each Corporation - looked up by Corporation id rather than by iteration
        // order, since state.corporations itself is in a randomly shuffled order (it doubles as
        // the Initial Auction order in the standard Setup) and this assignment has to be the same
        // every game for a given player count, exactly as the rulebook's diagrams show it.
        const presidentPlayerIdByCorp = new Map<CorporationId, string>()
        presidentsByPlayerIndex.forEach((corporationIds, playerIndex) => {
            const playerId = playerIds[playerIndex]
            if (!playerId) {
                return
            }
            corporationIds.forEach((corporationId) => presidentPlayerIdByCorp.set(corporationId, playerId))
        })

        // Amethyst Agency isn't part of this - it has no President until it's formed in Era 3.
        const startingCorporations = state.corporations.filter((corporation) => corporation.active)
        const spentByPlayerId = new Map<string, number>()
        startingCorporations.forEach((corporation, index) => {
            const setup = setupByCorp[corporation.id]
            if (!setup) {
                return
            }
            corporation.treasury = setup.treasury
            corporation.powers.push({ id: setup.secondPowerId })

            const presidentPlayerId = presidentPlayerIdByCorp.get(corporation.id)
            if (presidentPlayerId) {
                corporation.issueShareToPlayer(presidentPlayerId, index, setup.treasury)
                spentByPlayerId.set(
                    presidentPlayerId,
                    (spentByPlayerId.get(presidentPlayerId) ?? 0) + setup.treasury
                )
            }
        })

        const baselinePerPlayer = Math.floor(STARTING_FUNDS_POOL / playerIds.length)
        for (const player of state.players) {
            player.liquidFunds = baselinePerPlayer - (spentByPlayerId.get(player.playerId) ?? 0)
        }
    }
}
