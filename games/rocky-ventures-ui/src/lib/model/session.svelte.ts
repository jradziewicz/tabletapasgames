import { GameEngine } from '@tabletop/common'
import { GameSession, TitlePreferences } from '@tabletop/frontend-components'
import {
    ActionType,
    ChooseShare,
    ClaimMine,
    ExtractAndSell,
    Hunt,
    Acquire,
    AgreementPointBuy,
    DiscardAgreement,
    LayFreeTrack,
    type AgreementLetter,
    GemAction,
    type GemActionKind,
    type AcquireChoice,
    acquireChoices,
    investCost,
    reasonGemActionInvalid,
    planAcquire,
    ResolveHunt,
    SkipBonusInvest,
    WeaponTokenKind,
    huntTargets,
    LayTrack,
    extractableMineIds,
    routeNeighbors,
    planExtraction,
    DeliveryCityId,
    CardBonusKind,
    CardActionKind,
    CardKind,
    getCard,
    remainingActionKinds,
    ChooseAgreementGemCost,
    StackCardGemCost,
    stackableCardIds,
    isTwoSidedAgreement,
    type ExtractionPlan,
    MachineState,
    buildableBoxes,
    layTrackLimits,
    claimableMineIds,
    claimHuntRegions,
    BoardNodesById,
    EndTurn,
    Invest,
    MovePawn,
    skippedIndexes,
    PointBuy,
    Tax,
    type CompanyId,
    type RegionId,
    RockyVenturesPreferenceDefinition,
    Definition,
    type RockyVenturesPreferences,
    type RockyVenturesGameState,
    type HydratedRockyVenturesGameState
} from '@tabletop/rocky-ventures'
import { BotProfile, type BotMove } from '$lib/bots/rockyBots.js'
import { pawnMoveEndsTurnReason } from '$lib/utils/pawnMovePreview.js'

export type ExtractAnimation = {
    nodeId: string
    silverTokenId: string | undefined
    goldTokenId: string
    companyId: CompanyId | undefined
    tier: 'A' | 'B'
    phase: 'flip' | 'fly'
}

export type ConvertShareSelection = { companyId: CompanyId; shareIndex: number }

export type LiveSelection = {
    actionCount: number
    moveTargetIndex?: number
    moveDiscardIndexes: number[]
    movePaidIndexes: number[]
    step?: string
    huntSelected: number[]
    huntHitTargets: string[]
    huntHitTargetMap?: Record<number, string>
    huntFocusHit?: number
    acquireMode?: boolean
    lookingAtCardId?: string
    trackCompanyId?: string
    extractNodeId?: string
    extractCityId?: string
    extractCreditCompanyId?: string
}

const ActionTypeByCardAction: Record<CardActionKind, ActionType> = {
    [CardActionKind.Tax]: ActionType.Tax,
    [CardActionKind.Invest]: ActionType.Invest,
    [CardActionKind.ClaimMine]: ActionType.ClaimMine,
    [CardActionKind.LayTrack]: ActionType.LayTrack,
    [CardActionKind.ExtractAndSell]: ActionType.ExtractAndSell,
    [CardActionKind.Hunt]: ActionType.Hunt,
    [CardActionKind.Acquire]: ActionType.Acquire
}

export class RockyVenturesGameSession extends GameSession<
    RockyVenturesGameState,
    HydratedRockyVenturesGameState
> {
    lastActionError: string | undefined = $state()

    // Live play: a card just bought or taxed, popping up and then highlighted where it landed.
    spotlight:
        | {
              kind: 'card' | 'hunt' | 'claim'
              playerId: string
              phase: 'up' | 'landed'
              cardId?: string
              nodeId?: string
              hunt?: { region: string; tokens: { kind: string; applied: boolean }[]; hitTargets: string[]; gains: string[] }
              claim?: { mine: string; cost: number }
          }
        | undefined = $state()

    // Live play: what the current player has selected but not confirmed yet.
    private remoteSelection: LiveSelection | undefined = $state()

    zoomedImage: { url: string; alt: string } | undefined = $state()
    // Buying an agreement card while holding a gem: choose which agreement to take first.
    agreementPick: { slotIndex: number; cityId: DeliveryCityId } | undefined = $state()
    stackPick: { slotIndex: number } | undefined = $state()
    gridZoomOpen = $state(false)
    hoveredCard: { url: string; alt: string } | undefined = $state()
    botSeats: Record<string, BotProfile> = $state({})
    claimHuntNodeId: string | undefined = $state()
    private botSeatsLoadedFor: string | undefined

    scourgeOverlayRegion: RegionId | undefined = $state()
    newScourgeId: string | undefined = $state()
    revealScourgeId: string | undefined = $state()
    landedScourgeId: string | undefined = $state()

    splayedShareCompanyId: CompanyId | undefined = $state()

    moveTargetIndex: number | undefined = $state()
    // Why the chosen pawn move would end the turn at once (nothing on that card is usable), shown
    // so the player can confirm or pick another card.
    moveEndsTurnWarning: string | undefined = $state()
    moveDiscardIndexes: number[] = $state([])
    movePaidIndexes: number[] = $state([])
    discardAnimating = $state(false)
    investPickerOpen = $state(false)
    trackMode = $state(false)
    extractMode = $state(false)
    huntMode = $state(false)
    acquireMode = $state(false)
    gemMode: GemActionKind | undefined = $state()
    // First card picked for a gem swap by clicking market cards; the second click must be a neighbour
    swapPickSlot: number | undefined = $state()
    discardPick: { cityId: DeliveryCityId; letter: AgreementLetter } | undefined = $state()
    huntSelected: number[] = $state([])
    huntHitTargets: Record<number, string> = $state({})
    huntFocusHit: number | undefined = $state()
    extractNodeId: string | undefined = $state()
    extractCityId: DeliveryCityId | undefined = $state()
    extractHoverNodeId: string | undefined = $state()
    extractHoverCityId: DeliveryCityId | undefined = $state()
    extractCreditCompanyId: CompanyId | undefined = $state()
    extractCustomRoute: string[] | undefined = $state()
    layoutFrozen = $state(false)
    extractAnimation: ExtractAnimation | undefined = $state()
    holdScourgeOverlay = $state(false)
    trackCompanyId: CompanyId | undefined = $state()
    pointBuyBundles = $state(0)
    pointBuyConvertShare: ConvertShareSelection | undefined = $state()

    readonly preferences: TitlePreferences<typeof RockyVenturesPreferences> =
        this.createPreferences(RockyVenturesPreferenceDefinition)

    zoomCard(cardId: string, url: string | undefined) {
        if (url) {
            this.zoomedImage = { url, alt: cardId }
        }
    }

    get hasManualSelection(): boolean {
        return (
            this.claimHuntNodeId !== undefined ||
            this.extractCustomRoute !== undefined ||
            this.moveTargetIndex !== undefined ||
            this.investPickerOpen ||
            this.trackMode ||
            this.extractMode ||
            this.huntMode ||
            this.acquireMode ||
            this.gemMode !== undefined ||
            this.discardPick !== undefined ||
            this.pointBuyBundles > 0 ||
            this.pointBuyConvertShare !== undefined
        )
    }

    clearLocalSelection() {
        this.claimHuntNodeId = undefined
        this.extractHoverCityId = undefined
        this.moveTargetIndex = undefined
        this.moveEndsTurnWarning = undefined
        this.moveDiscardIndexes = []
        this.movePaidIndexes = []
        this.discardAnimating = false
        this.investPickerOpen = false
        this.trackMode = false
        this.trackCompanyId = undefined
        this.extractMode = false
        this.huntMode = false
        this.acquireMode = false
        this.gemMode = undefined
        this.swapPickSlot = undefined
        this.discardPick = undefined
        this.huntSelected = []
        this.huntHitTargets = {}
        this.huntFocusHit = undefined
        this.extractNodeId = undefined
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
        this.extractCustomRoute = undefined
        this.pointBuyBundles = 0
        this.pointBuyConvertShare = undefined
    }

    override beforeNewState(): void {
        this.lastActionError = undefined
        this.zoomedImage = undefined
        this.hoveredCard = undefined
        this.splayedShareCompanyId = undefined
        this.clearLocalSelection()
    }

    override async undo() {
        if (this.hasManualSelection) {
            this.clearLocalSelection()
            return
        }
        await super.undo()
    }

    async selectMoveTarget(index: number) {
        const playerId = this.gameState.activePlayerIds[0]
        const player = playerId ? this.gameState.findPlayerState(playerId) : undefined
        const skipped = player ? skippedIndexes(player, index) : undefined
        if (!skipped) {
            return
        }
        this.moveTargetIndex = index
        this.moveEndsTurnWarning = undefined
        this.moveDiscardIndexes = []
        this.movePaidIndexes = []
        if (skipped.length === 0 || player?.pawnIndex === undefined) {
            await this.confirmMove()
        }
    }

    async decideSkippedCard(index: number, discard: boolean) {
        const playerId = this.gameState.activePlayerIds[0]
        const player = playerId ? this.gameState.findPlayerState(playerId) : undefined
        const target = this.moveTargetIndex
        const skipped = player && target !== undefined ? skippedIndexes(player, target) : undefined
        if (!skipped || !skipped.includes(index)) {
            return
        }
        this.moveDiscardIndexes = this.moveDiscardIndexes.filter((candidate) => candidate !== index)
        this.movePaidIndexes = this.movePaidIndexes.filter((candidate) => candidate !== index)
        if (discard) {
            this.moveDiscardIndexes = [...this.moveDiscardIndexes, index]
        } else {
            this.movePaidIndexes = [...this.movePaidIndexes, index]
        }
        if (this.moveDiscardIndexes.length + this.movePaidIndexes.length === skipped.length) {
            await this.confirmMove()
        }
    }

    get claimableNodeIds(): string[] {
        const playerId = this.gameState.activePlayerIds[0]
        if (
            playerId === undefined ||
            !this.seesActiveView ||
            this.gameState.machineState !== MachineState.TakeActions ||
            this.extractActive ||
            this.trackActive ||
            this.huntActive ||
            this.acquireActive ||
            this.investPickerOpen ||
            !this.offeredActionTypes.includes(ActionType.ClaimMine)
        ) {
            return []
        }
        return claimableMineIds(this.gameState, playerId)
    }

    get huntActive(): boolean {
        return (
            this.huntMode ||
            (!this.trackMode &&
                !this.extractMode &&
                this.autoActionKind === ActionType.Hunt)
        )
    }

    get acquireActive(): boolean {
        return (
            this.acquireMode ||
            (!this.trackMode &&
                !this.extractMode &&
                !this.huntMode &&
                this.autoActionKind === ActionType.Acquire)
        )
    }

    get acquirePlans() {
        const playerId = this.gameState.activePlayerIds[0]
        if (!this.acquireActive || playerId === undefined || !this.seesActiveView) {
            return []
        }
        const player = this.gameState.getPlayerState(playerId)
        return acquireChoices(this.gameState, playerId).flatMap((choice) => {
            const plan = planAcquire(this.gameState, playerId, choice)
            const useful =
                plan !== undefined &&
                (plan.victoryPoints > 0 ||
                    plan.destination.weapon !== player.weaponLevel ||
                    plan.destination.tool !== player.toolLevel)
            return plan && useful ? [plan] : []
        }).filter(
            (plan, index, plans) =>
                plans.findIndex(
                    (other) =>
                        other.destination.weapon === plan.destination.weapon &&
                        other.destination.tool === plan.destination.tool &&
                        other.victoryPoints === plan.victoryPoints
                ) === index
        )
    }

    loadBotSeats() {
        if (this.botSeatsLoadedFor === this.game.id) {
            return
        }
        this.botSeatsLoadedFor = this.game.id
        const config = this.game.config
        const count = (value: unknown) => (typeof value === 'string' ? Number.parseInt(value, 10) || 0 : 0)
        const profiles: BotProfile[] = [
            ...Array<BotProfile>(count(config.hunterBots)).fill(BotProfile.Hunter),
            ...Array<BotProfile>(count(config.taxBots)).fill(BotProfile.Tax)
        ]
        const openSeats = this.game.players.slice(1)
        const botCount = Math.min(profiles.length, openSeats.length)
        const seats: Record<string, BotProfile> = {}
        for (let index = 0; index < botCount; index++) {
            const player = openSeats[openSeats.length - botCount + index]
            const profile = profiles[index]
            if (player && profile) {
                seats[player.id] = profile
            }
        }
        this.botSeats = seats
    }

    async executeBotMove(move: BotMove) {
        this.lastActionError = undefined
        try {
            switch (move.type) {
                case ActionType.MovePawn:
                    await this.applyAction(this.createPlayerAction(MovePawn, { targetIndex: move.targetIndex, discardIndexes: move.discardIndexes }))
                    return
                case ActionType.Tax:
                    await this.applyAction(this.createPlayerAction(Tax, {}))
                    return
                case ActionType.Invest:
                    await this.applyAction(this.createPlayerAction(Invest, { slotIndex: move.slotIndex }))
                    return
                case ActionType.SkipBonusInvest:
                    await this.applyAction(this.createPlayerAction(SkipBonusInvest, {}))
                    return
                case ActionType.ClaimMine:
                    await this.applyAction(this.createPlayerAction(ClaimMine, { nodeId: move.nodeId }))
                    return
                case ActionType.LayTrack:
                    await this.applyAction(this.createPlayerAction(LayTrack, { companyId: move.companyId, boxId: move.boxId }))
                    return
                case ActionType.ExtractAndSell:
                    await this.applyAction(
                        this.createPlayerAction(ExtractAndSell, {
                            nodeId: move.nodeId,
                            cityId: move.cityId,
                            creditCompanyId: move.creditCompanyId
                        })
                    )
                    return
                case ActionType.Hunt:
                    await this.applyAction(this.createPlayerAction(Hunt, { region: move.region }))
                    return
                case ActionType.ResolveHunt:
                    await this.applyAction(this.createPlayerAction(ResolveHunt, { tokenIndexes: move.tokenIndexes, hitTargets: move.hitTargets }))
                    return
                case ActionType.Acquire:
                    await this.applyAction(this.createPlayerAction(Acquire, { choice: move.choice }))
                    return
                case ActionType.ChooseShare:
                    await this.applyAction(this.createPlayerAction(ChooseShare, { companyId: move.companyId }))
                    return
                case ActionType.PointBuy:
                    await this.applyAction(this.createPlayerAction(PointBuy, { bundles: move.bundles, convertShare: move.convertShare }))
                    return
                case ActionType.AgreementPointBuy:
                    await this.applyAction(this.createPlayerAction(AgreementPointBuy, { buy: move.buy }))
                    return
                case ActionType.LayFreeTrack:
                    await this.applyAction(this.createPlayerAction(LayFreeTrack, { boxId: move.boxId }))
                    return
                case ActionType.GemAction:
                    await this.applyAction(this.createPlayerAction(GemAction, { kind: move.kind, target: move.target }))
                    return
                case ActionType.EndTurn:
                    await this.applyAction(this.createPlayerAction(EndTurn, {}))
                    return
            }
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async buyAgreementPoints(buy: boolean) {
        await this.submit(ActionType.AgreementPointBuy, async () => {
            await this.applyAction(this.createPlayerAction(AgreementPointBuy, { buy }))
        })
    }

    async spendGems(kind: GemActionKind, target = 0) {
        await this.submit(ActionType.GemAction, async () => {
            await this.applyAction(this.createPlayerAction(GemAction, { kind, target }))
        })
        this.gemMode = undefined
    }

    startAcquireMode() {
        this.acquireMode = true
    }

    async acquire(choice: AcquireChoice) {
        await this.submit(ActionType.Acquire, async () => {
            await this.applyAction(this.createPlayerAction(Acquire, { choice }))
        })
        this.acquireMode = false
    }

    startHuntMode() {
        this.huntMode = true
    }

    async hunt(region: string) {
        await this.submit(ActionType.Hunt, async () => {
            await this.applyAction(this.createPlayerAction(Hunt, { region }))
        })
        this.huntMode = false
    }

    get huntTargetsForPending() {
        const pending = this.gameState.pendingHunt
        return pending ? huntTargets(this.gameState, pending.region) : []
    }

    huntAssignedCount(targetId: string): number {
        return Object.values(this.huntHitTargets).filter((assigned) => assigned === targetId).length
    }

    private autoHuntTarget(): string | undefined {
        const targets = [...this.huntTargetsForPending].sort(
            (left, right) => left.level - right.level || right.hits - left.hits
        )
        const open = targets.find(
            (target) => target.level - target.hits - this.huntAssignedCount(target.id) > 0
        )
        return open?.id ?? targets.at(-1)?.id
    }

    toggleHuntToken(index: number) {
        const pending = this.gameState.pendingHunt
        if (!pending) {
            return
        }
        const isHit = pending.drawn[index] === WeaponTokenKind.Hit
        if (this.huntSelected.includes(index)) {
            if (isHit && this.huntFocusHit !== index) {
                this.huntFocusHit = index
                return
            }
            this.huntSelected = this.huntSelected.filter((selected) => selected !== index)
            const { [index]: _removed, ...rest } = this.huntHitTargets
            this.huntHitTargets = rest
            if (this.huntFocusHit === index) {
                this.huntFocusHit = this.huntSelected
                    .filter((selected) => pending.drawn[selected] === WeaponTokenKind.Hit)
                    .at(-1)
            }
            return
        }
        if (this.huntSelected.length >= Math.min(pending.apply, pending.drawn.length)) {
            return
        }
        this.huntSelected = [...this.huntSelected, index].sort((a, b) => a - b)
        if (isHit) {
            const target = this.autoHuntTarget()
            if (target !== undefined) {
                this.huntHitTargets = { ...this.huntHitTargets, [index]: target }
            }
            this.huntFocusHit = index
        }
    }

    assignFocusedHit(targetId: string) {
        const index = this.huntFocusHit
        if (index === undefined || !this.huntSelected.includes(index)) {
            return
        }
        this.huntHitTargets = { ...this.huntHitTargets, [index]: targetId }
    }

    get huntReady(): boolean {
        const pending = this.gameState.pendingHunt
        if (!pending) {
            return false
        }
        if (pending.drawn.length > 0 && this.huntSelected.length < 1) {
            return false
        }
        return this.huntSelected.every(
            (index) =>
                pending.drawn[index] !== WeaponTokenKind.Hit ||
                this.huntHitTargets[index] !== undefined
        )
    }

    // Decline every drawn token ("apply up to N" allows none); they all go back in the bag.
    async resolveHuntApplyingNone() {
        if (!this.gameState.pendingHunt) {
            return
        }
        this.huntSelected = []
        this.huntHitTargets = {}
        await this.submit(ActionType.ResolveHunt, async () => {
            await this.applyAction(this.createPlayerAction(ResolveHunt, { tokenIndexes: [], hitTargets: [] }))
        })
    }

    async resolveHunt() {
        const pending = this.gameState.pendingHunt
        if (!pending || !this.huntReady) {
            return
        }
        const tokenIndexes = [...this.huntSelected]
        const hitTargets = tokenIndexes
            .filter((index) => pending.drawn[index] === WeaponTokenKind.Hit)
            .map((index) => this.huntHitTargets[index]!)
        await this.submit(ActionType.ResolveHunt, async () => {
            await this.applyAction(
                this.createPlayerAction(ResolveHunt, { tokenIndexes, hitTargets })
            )
        })
        this.huntSelected = []
        this.huntHitTargets = {}
        this.huntFocusHit = undefined
    }

    async skipBonusInvest() {
        await this.submit(ActionType.SkipBonusInvest, async () => {
            await this.applyAction(this.createPlayerAction(SkipBonusInvest, {}))
        })
    }

    // The card's actions the player passed on this turn, so Pass moves to the next one instead of
    // ending the whole turn.
    private passedActions: { turn: number; types: string[] } | undefined = $state()

    get passedActionTypes(): string[] {
        const passed = this.passedActions
        return passed?.turn === this.gameState.turnManager.series.length ? passed.types : []
    }

    // What the player is offered now. In games played top to bottom that's only the next action on
    // the card; Pass moves on to the one below it.
    get offeredActionTypes(): string[] {
        const valid = this.mirroring ? this.mirrorValidActionTypes : this.validActionTypes
        const state = this.gameState
        const playerId = state.activePlayerIds[0]
        const cardId = playerId === undefined ? undefined : state.actionCardId(playerId)
        const card = cardId === undefined ? undefined : getCard(cardId)
        if (
            !state.actionsInOrder ||
            state.machineState !== MachineState.TakeActions ||
            !card ||
            (card.kind === CardKind.Player && card.exclusiveActions)
        ) {
            return valid
        }
        const cardTypes: string[] = Object.values(ActionTypeByCardAction)
        const next = remainingActionKinds(state)
            .map((kind) => ActionTypeByCardAction[kind])
            .find((type) => valid.includes(type) && !this.passedActionTypes.includes(type))
        return valid.filter((type) => !cardTypes.includes(type) || type === next)
    }

    // Live play: while someone else plays, show their panel and selections as if it were ours,
    // read-only (the panel is inert and nothing can be submitted for them).
    get mirroring(): boolean {
        return this.livePlay && !this.isMyTurn && !this.isViewingHistory && this.watchedSelection !== undefined
    }

    get seesActiveView(): boolean {
        return this.isMyTurn || this.mirroring
    }

    private mirrorEngine = new GameEngine(Definition.runtime)

    // Worked out once per change of game state, since the panel asks for it many times a render.
    private mirrorValidActionTypes: string[] = $derived.by(() => {
        const activeId = this.gameState.activePlayerIds[0]
        if (!this.livePlay || this.isMyTurn || !activeId) return []
        try {
            return this.mirrorEngine.getValidActionTypesForPlayer(this.primaryGame, this.gameState.dehydrate() as never, activeId)
        } catch {
            return []
        }
    })

    // Copies the watched player's selection into this screen's own selection state.
    applyMirror() {
        const selection = this.watchedSelection
        if (!this.mirroring || !selection) return
        this.moveTargetIndex = selection.moveTargetIndex
        this.moveDiscardIndexes = [...selection.moveDiscardIndexes]
        this.movePaidIndexes = [...selection.movePaidIndexes]
        this.investPickerOpen = selection.step === 'Invest'
        this.trackMode = selection.step === 'Lay Track'
        this.extractMode = selection.step === 'Extract & Sell'
        this.huntMode = selection.step === 'Hunt'
        this.acquireMode = selection.acquireMode ?? selection.step === 'Acquire'
        this.huntSelected = [...selection.huntSelected]
        this.huntHitTargets = { ...(selection.huntHitTargetMap ?? {}) }
        this.huntFocusHit = selection.huntFocusHit
        this.trackCompanyId = selection.trackCompanyId as CompanyId | undefined
        this.extractNodeId = selection.extractNodeId
        this.extractCityId = selection.extractCityId as DeliveryCityId | undefined
        this.extractCreditCompanyId = selection.extractCreditCompanyId as CompanyId | undefined
    }

    get livePlay(): boolean {
        return (this.primaryGame.config as { livePlay?: boolean } | undefined)?.livePlay === true && !this.primaryGame.hotseat
    }

    // Selections are only good for the position they were made in.
    get watchedSelection(): LiveSelection | undefined {
        const selection = this.remoteSelection
        return selection?.actionCount === this.gameState.actionCount ? selection : undefined
    }

    get mySelection(): LiveSelection {
        return {
            actionCount: this.gameState.actionCount,
            moveTargetIndex: this.moveTargetIndex,
            moveDiscardIndexes: [...this.moveDiscardIndexes],
            movePaidIndexes: [...this.movePaidIndexes],
            step: this.investPickerOpen
                ? 'Invest'
                : this.trackMode
                  ? 'Lay Track'
                  : this.extractMode
                    ? 'Extract & Sell'
                    : this.huntMode
                      ? 'Hunt'
                      : this.acquireMode
                        ? 'Acquire'
                        : this.gemMode,
            huntSelected: [...this.huntSelected],
            huntHitTargets: Object.values(this.huntHitTargets),
            huntHitTargetMap: { ...this.huntHitTargets },
            huntFocusHit: this.huntFocusHit,
            acquireMode: this.acquireMode,
            lookingAtCardId: this.zoomedImage?.alt ?? this.hoveredCard?.alt ?? this.pointedCardId,
            trackCompanyId: this.trackCompanyId,
            extractNodeId: this.extractNodeId,
            extractCityId: this.extractCityId,
            extractCreditCompanyId: this.extractCreditCompanyId
        }
    }

    shareMySelection() {
        if (this.livePlay && this.isMyTurn && !this.isViewingHistory) {
            this.sendLiveSelection({ ...this.mySelection })
        }
    }

    protected override onLiveSelection(_playerId: string, selection: Record<string, unknown>) {
        this.remoteSelection = selection as LiveSelection
    }

    async passAction(type: ActionType) {
        const passed = [...this.passedActionTypes, type]
        const others = this.validActionTypes.filter(
            (other) =>
                !passed.includes(other) &&
                (other === ActionType.Tax ||
                    other === ActionType.Invest ||
                    other === ActionType.ClaimMine ||
                    other === ActionType.LayTrack ||
                    other === ActionType.ExtractAndSell ||
                    other === ActionType.Hunt ||
                    other === ActionType.Acquire)
        )
        if (others.length === 0) {
            await this.endTurn()
            return
        }
        this.passedActions = { turn: this.gameState.turnManager.series.length, types: passed }
        this.clearLocalSelection()
    }

    get autoActionKind(): ActionType | undefined {
        if (
            !this.seesActiveView ||
            this.gameState.machineState !== MachineState.TakeActions ||
            this.investPickerOpen
        ) {
            return undefined
        }
        const kinds = this.offeredActionTypes.filter(
            (type) =>
                type === ActionType.Tax ||
                type === ActionType.Invest ||
                type === ActionType.ClaimMine ||
                type === ActionType.LayTrack ||
                type === ActionType.ExtractAndSell ||
                type === ActionType.Hunt ||
                type === ActionType.Acquire
        ).filter((type) => !this.passedActionTypes.includes(type))
        return kinds.length === 1 ? kinds[0] : undefined
    }

    get trackActive(): boolean {
        return this.trackMode || (!this.extractMode && this.autoActionKind === ActionType.LayTrack)
    }

    get extractActive(): boolean {
        return (
            this.extractMode ||
            (!this.trackMode && this.autoActionKind === ActionType.ExtractAndSell)
        )
    }

    get extractableNodeIds(): string[] {
        const playerId = this.gameState.activePlayerIds[0]
        if (!this.extractActive || playerId === undefined || !this.seesActiveView) {
            return []
        }
        return extractableMineIds(this.gameState, playerId)
    }

    // Live play: the routes the current player is looking at, for everyone watching.
    get watchedRoutePreviews(): { cityId: DeliveryCityId; routeNodeIds: string[]; net: number }[] {
        const selection = this.livePlay && !this.isMyTurn ? this.watchedSelection : undefined
        const playerId = this.gameState.activePlayerIds[0]
        const nodeId = selection?.extractNodeId
        if (!selection || playerId === undefined || nodeId === undefined) return []
        if (this.gameState.board.mines[nodeId]?.token?.ore !== 'gold') return []
        const shownCity = selection.extractCityId as DeliveryCityId | undefined
        const cities: DeliveryCityId[] = shownCity ? [shownCity] : [DeliveryCityId.Dornoch, DeliveryCityId.Manor]
        return cities.flatMap((cityId) => {
            const plan = planExtraction(this.gameState, playerId, { nodeId, cityId })
            return typeof plan === 'string' || plan.routeNodeIds.length < 2 ? [] : [{ cityId, routeNodeIds: plan.routeNodeIds, net: plan.net }]
        })
    }

    get extractRoutePreviews(): { cityId: DeliveryCityId; routeNodeIds: string[]; net: number }[] {
        const playerId = this.gameState.activePlayerIds[0]
        const nodeId = this.extractHoverNodeId ?? this.extractNodeId
        if (!this.extractActive || playerId === undefined || nodeId === undefined || !this.seesActiveView) {
            return []
        }
        if (this.gameState.board.mines[nodeId]?.token?.ore !== 'gold') {
            return []
        }
        if (this.extractCustomRoute && this.extractHoverNodeId === undefined) {
            return []
        }
        const hoveringMine = this.extractHoverNodeId !== undefined
        const shownCity = this.extractHoverCityId ?? this.extractCityId
        const cities: DeliveryCityId[] = hoveringMine
            ? [DeliveryCityId.Dornoch, DeliveryCityId.Manor]
            : shownCity
              ? [shownCity]
              : []
        const previews = cities
            .flatMap((cityId) => {
                const plan = planExtraction(this.gameState, playerId, { nodeId, cityId })
                return typeof plan === 'string' || plan.routeNodeIds.length < 2
                    ? []
                    : [{ cityId, routeNodeIds: plan.routeNodeIds, net: plan.net }]
            })
            .sort((left, right) => right.net - left.net)
        const [best, other] = previews
        if (!best || !other) {
            return previews
        }
        let shared = 0
        while (shared < best.routeNodeIds.length && best.routeNodeIds[shared] === other.routeNodeIds[shared]) {
            shared += 1
        }
        return [best, { ...other, routeNodeIds: other.routeNodeIds.slice(Math.max(0, shared - 1)) }]
    }

    get extractCustomCityId(): DeliveryCityId | undefined {
        const last = this.extractCustomRoute?.at(-1)
        return last === DeliveryCityId.Dornoch || last === DeliveryCityId.Manor ? last : undefined
    }

    get extractRouteChoices(): string[] {
        const route = this.extractCustomRoute
        const last = route?.at(-1)
        if (!route || last === undefined) {
            return []
        }
        return routeNeighbors(last).filter((nodeId) => !route.includes(nodeId))
    }

    startModifyRoute() {
        if (this.extractNodeId === undefined) {
            return
        }
        this.extractCustomRoute = [this.extractNodeId]
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
    }

    cancelModifyRoute() {
        this.extractCustomRoute = undefined
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
    }

    stepCustomRoute(nodeId: string) {
        const route = this.extractCustomRoute
        if (!route) {
            return
        }
        const existing = route.indexOf(nodeId)
        if (existing >= 0) {
            this.extractCustomRoute = route.slice(0, Math.max(1, existing + 1))
        } else if (this.extractRouteChoices.includes(nodeId)) {
            this.extractCustomRoute = [...route, nodeId]
        } else {
            return
        }
        this.extractCityId = this.extractCustomCityId
        this.extractCreditCompanyId = undefined
    }

    undoCustomRouteStep() {
        const route = this.extractCustomRoute
        if (!route || route.length <= 1) {
            return
        }
        this.extractCustomRoute = route.slice(0, -1)
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
    }

    get extractPlan(): ExtractionPlan | undefined {
        const playerId = this.gameState.activePlayerIds[0]
        if (this.extractNodeId === undefined || playerId === undefined) {
            return undefined
        }
        const plan = planExtraction(this.gameState, playerId, {
            nodeId: this.extractNodeId,
            cityId: this.extractCityId,
            creditCompanyId: this.extractCreditCompanyId,
            routeNodeIds: this.extractCustomCityId ? this.extractCustomRoute : undefined
        })
        return typeof plan === 'string' ? undefined : plan
    }

    startExtractMode() {
        this.extractMode = true
        this.extractNodeId = undefined
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
    }

    async selectExtractMine(nodeId: string) {
        if (!this.extractableNodeIds.includes(nodeId)) {
            return
        }
        this.extractNodeId = nodeId
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
        this.extractCustomRoute = undefined
    }

    async selectExtractCity(cityId: DeliveryCityId) {
        this.extractCityId = cityId
        this.extractHoverCityId = undefined
        this.extractCreditCompanyId = undefined
        const plan = this.extractPlan
        if (plan && plan.creditCandidates.length <= 1) {
            await this.confirmExtract()
        }
    }

    async selectExtractCredit(companyId: CompanyId) {
        this.extractCreditCompanyId = companyId
        if (!this.extractCustomRoute) {
            await this.confirmExtract()
        }
    }

    async confirmExtract() {
        const nodeId = this.extractNodeId
        if (nodeId === undefined) {
            return
        }
        const before = this.gameState.board.mines[nodeId]?.token
        const plan = this.extractPlan
        if (before?.ore === 'gold') {
            this.holdScourgeOverlay = true
            this.layoutFrozen = true
        }
        await this.submit(ActionType.ExtractAndSell, async () => {
            await this.applyAction(
                this.createPlayerAction(ExtractAndSell, {
                    nodeId,
                    cityId: this.extractCityId,
                    creditCompanyId: this.extractCreditCompanyId,
                    routeNodeIds: this.extractCustomCityId ? this.extractCustomRoute : undefined
                })
            )
        })
        this.extractCustomRoute = undefined
        this.extractNodeId = undefined
        this.extractCityId = undefined
        this.extractCreditCompanyId = undefined
        this.extractMode = false
        if (this.lastActionError !== undefined) {
            this.holdScourgeOverlay = false
            this.layoutFrozen = false
        }
        if (before && before.ore === 'gold') {
            const silver = this.gameState.board.mines[nodeId]?.token
            this.playExtractAnimation({
                nodeId,
                silverTokenId: silver?.id,
                goldTokenId: before.id,
                companyId: plan?.creditCompanyId,
                tier: before.tier === 'A' ? 'A' : 'B',
                phase: 'flip'
            })
        }
    }

    private playExtractAnimation(animation: ExtractAnimation) {
        this.extractAnimation = animation
        setTimeout(() => {
            if (this.extractAnimation === animation || this.extractAnimation?.goldTokenId === animation.goldTokenId) {
                this.extractAnimation = { ...animation, phase: 'fly' }
            }
        }, 2600)
        setTimeout(() => {
            if (this.extractAnimation?.goldTokenId === animation.goldTokenId) {
                this.extractAnimation = undefined
            }
            this.holdScourgeOverlay = false
            this.layoutFrozen = false
        }, 5000)
    }

    get buildableTrackBoxes(): { boxId: string; cost: number }[] {
        const playerId = this.gameState.activePlayerIds[0]
        const freeTrack = this.gameState.freeTrack
        if (this.gameState.machineState === MachineState.FreeTrack) {
            return freeTrack && this.seesActiveView && freeTrack.remaining > 0
                ? buildableBoxes(this.gameState, freeTrack.companyId, true)
                : []
        }
        if (
            !this.trackActive ||
            this.trackCompanyId === undefined ||
            playerId === undefined ||
            !this.seesActiveView ||
            this.gameState.machineState !== MachineState.TakeActions
        ) {
            return []
        }
        if (!layTrackLimits(this.gameState).allowedCompanyIds.includes(this.trackCompanyId)) {
            return []
        }
        return buildableBoxes(this.gameState, this.trackCompanyId)
    }

    startTrackMode() {
        this.trackMode = true
        this.trackCompanyId = undefined
    }

    selectTrackCompany(companyId: CompanyId) {
        this.trackCompanyId = companyId
    }

    get trackGlowCompanyId(): CompanyId | undefined {
        return this.gameState.freeTrack?.companyId ?? this.trackCompanyId
    }

    async discardAgreement(companyId: CompanyId) {
        const pick = this.discardPick
        if (!pick) {
            return
        }
        await this.submit(ActionType.DiscardAgreement, async () => {
            await this.applyAction(
                this.createPlayerAction(DiscardAgreement, { cityId: pick.cityId, letter: pick.letter, companyId })
            )
        })
        this.discardPick = undefined
    }

    async stopFreeTrack() {
        await this.submit(ActionType.LayFreeTrack, async () => {
            await this.applyAction(this.createPlayerAction(LayFreeTrack, {}))
        })
    }

    async layTrack(boxId: string) {
        if (this.gameState.machineState === MachineState.FreeTrack) {
            if (!this.buildableTrackBoxes.some((box) => box.boxId === boxId)) {
                return
            }
            await this.submit(ActionType.LayFreeTrack, async () => {
                await this.applyAction(this.createPlayerAction(LayFreeTrack, { boxId }))
            })
            return
        }
        const companyId = this.trackCompanyId
        if (companyId === undefined || !this.buildableTrackBoxes.some((box) => box.boxId === boxId)) {
            return
        }
        await this.submit(ActionType.LayTrack, async () => {
            await this.applyAction(this.createPlayerAction(LayTrack, { companyId, boxId }))
        })
        if (
            this.gameState.machineState === MachineState.TakeActions &&
            this.offeredActionTypes.includes(ActionType.LayTrack)
        ) {
            this.trackMode = true
            this.trackCompanyId = companyId
        }
    }

    async claimMine(nodeId: string, huntDragon?: boolean) {
        const playerId = this.gameState.activePlayerIds[0]
        if (!this.claimableNodeIds.includes(nodeId) || playerId === undefined) {
            return
        }
        const huntRegions = claimHuntRegions(this.gameState, playerId, BoardNodesById[nodeId]?.region)
        if (huntDragon === undefined && huntRegions.length > 1) {
            this.claimHuntNodeId = nodeId
            return
        }
        this.claimHuntNodeId = undefined
        await this.submit(ActionType.ClaimMine, async () => {
            await this.applyAction(this.createPlayerAction(ClaimMine, { nodeId, huntDragon: huntDragon ?? false }))
        })
    }

    toggleInvestPicker() {
        this.investPickerOpen = !this.investPickerOpen
    }

    setPointBuyBundles(count: number) {
        this.pointBuyBundles = Math.max(0, count)
    }

    toggleConvertShare(selection: ConvertShareSelection) {
        const current = this.pointBuyConvertShare
        const same =
            current !== undefined &&
            current.companyId === selection.companyId &&
            current.shareIndex === selection.shareIndex
        this.pointBuyConvertShare = same ? undefined : selection
    }

    private async submit(actionType: ActionType, build: () => Promise<void>) {
        if (!this.validActionTypes.includes(actionType)) {
            return
        }
        // The hovered card's element usually disappears once the action lands, so no pointerleave
        this.hoveredCard = undefined
        this.lastActionError = undefined
        try {
            await build()
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async confirmMove(evenIfTurnEnds = false) {
        const targetIndex = this.moveTargetIndex
        if (targetIndex === undefined) {
            return
        }
        const playerId = this.gameState.activePlayerIds[0]
        if (!evenIfTurnEnds && playerId !== undefined) {
            const reason = pawnMoveEndsTurnReason(this.gameState, playerId, targetIndex, this.moveDiscardIndexes)
            if (reason) {
                this.moveEndsTurnWarning = reason
                return
            }
        }
        this.moveEndsTurnWarning = undefined
        if (this.moveDiscardIndexes.length > 0) {
            this.discardAnimating = true
            await new Promise((resolve) => setTimeout(resolve, 1300))
        }
        await this.submit(ActionType.MovePawn, async () => {
            const action = this.createPlayerAction(MovePawn, {
                targetIndex,
                discardIndexes: [...this.moveDiscardIndexes]
            })
            await this.applyAction(action)
        })
    }

    async tax() {
        await this.submit(ActionType.Tax, async () => {
            await this.applyAction(this.createPlayerAction(Tax, {}))
        })
    }

    // What clicking a market card (on the board or in the Market tab) does right now - the same
    // thing as the matching action-panel button. Undefined means the click just shows the card.
    marketClick(slotIndex: number): 'gemMarket' | 'swap' | 'buy' | undefined {
        const playerId = this.gameState.activePlayerIds[0]
        if (!playerId || this.validActionTypes.length === 0) {
            return undefined
        }
        if (this.gemMode === 'market') {
            return reasonGemActionInvalid(this.gameState, playerId, 'market', slotIndex) === undefined ? 'gemMarket' : undefined
        }
        if (this.gemMode === 'swap') {
            const canSwap = (left: number) =>
                left >= 0 && reasonGemActionInvalid(this.gameState, playerId, 'swap', left) === undefined
            return canSwap(slotIndex) || canSwap(slotIndex - 1) ? 'swap' : undefined
        }
        const canInvest =
            this.gameState.machineState === MachineState.BonusInvest || this.offeredActionTypes.includes(ActionType.Invest)
        const cost = investCost(this.gameState, slotIndex)
        if (canInvest && cost !== undefined && cost <= this.gameState.getPlayerState(playerId).money) {
            return 'buy'
        }
        return undefined
    }

    async clickMarketCard(slotIndex: number, cardId: string, url: string | undefined) {
        switch (this.marketClick(slotIndex)) {
            case 'gemMarket':
                await this.spendGems('market', slotIndex)
                return
            case 'swap': {
                const picked = this.swapPickSlot
                if (picked !== undefined && Math.abs(picked - slotIndex) === 1) {
                    this.swapPickSlot = undefined
                    await this.spendGems('swap', Math.min(picked, slotIndex))
                } else {
                    this.swapPickSlot = picked === slotIndex ? undefined : slotIndex
                }
                return
            }
            case 'buy':
                await this.invest(slotIndex)
                return
            default:
                // Nothing to do with it right now; a click still opens it large (touch has no hover)
                this.zoomCard(cardId, url)
        }
    }

    // Hover preview for any card image; mouse only, since a tap already opens the zoom
    previewCard(event: PointerEvent, cardId: string, url: string | undefined) {
        if (event.pointerType === 'mouse' && url) {
            this.hoveredCard = { url, alt: cardId }
        }
    }

    clearCardPreview() {
        this.hoveredCard = undefined
    }

    // A tableau card under the mouse: no big preview, but Live play watchers see it pulse.
    pointedCardId: string | undefined = $state()

    pointAtCard(event: PointerEvent, cardId: string | undefined) {
        if (event.pointerType === 'mouse') this.pointedCardId = cardId
    }

    async invest(slotIndex: number) {
        const cardId = this.gameState.market.slots[slotIndex]
        const card = cardId === undefined ? undefined : getCard(cardId)
        const playerId = this.gameState.activePlayerIds[0]
        const gems = playerId ? this.gameState.getPlayerState(playerId).gems : 0
        if (
            card?.kind === CardKind.Development &&
            playerId &&
            gems >= StackCardGemCost &&
            stackableCardIds(this.gameState, playerId).length > 0
        ) {
            this.stackPick = { slotIndex }
            return
        }
        if (
            card?.kind === CardKind.Development &&
            card.bonus.kind === CardBonusKind.Agreement &&
            gems >= ChooseAgreementGemCost &&
            (this.gameState.agreementStacks[card.bonus.cityId]?.length ?? 0) > 1 &&
            !isTwoSidedAgreement(this.gameState.agreementStacks[card.bonus.cityId]![0]!)
        ) {
            this.agreementPick = { slotIndex, cityId: card.bonus.cityId }
            return
        }
        await this.investWithAgreement(slotIndex, undefined)
    }

    async investWithAgreement(
        slotIndex: number,
        agreementLetter: AgreementLetter | undefined,
        stackOnCardId?: string
    ) {
        this.agreementPick = undefined
        this.stackPick = undefined
        await this.submit(ActionType.Invest, async () => {
            await this.applyAction(
                this.createPlayerAction(Invest, {
                    slotIndex,
                    ...(agreementLetter ? { agreementLetter } : {}),
                    ...(stackOnCardId ? { stackOnCardId } : {})
                })
            )
        })
    }

    async endTurn() {
        await this.submit(ActionType.EndTurn, async () => {
            await this.applyAction(this.createPlayerAction(EndTurn, {}))
        })
    }

    async chooseShare(companyId: CompanyId) {
        await this.submit(ActionType.ChooseShare, async () => {
            await this.applyAction(this.createPlayerAction(ChooseShare, { companyId }))
        })
    }

    async submitPointBuy() {
        const convertShare = this.pointBuyConvertShare
        const bundles = this.pointBuyBundles
        await this.submit(ActionType.PointBuy, async () => {
            const action = this.createPlayerAction(
                PointBuy,
                convertShare ? { bundles, convertShare } : { bundles }
            )
            await this.applyAction(action)
        })
    }
}
