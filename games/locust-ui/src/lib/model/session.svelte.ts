import { GameSession, TitlePreferences } from '@tabletop/frontend-components'
import { addVictim, hasVictimChoice, victimOptions, type VictimOption } from '$lib/utils/cannibalize.js'
import type { Color } from '@tabletop/common'
import {
    ActionKind,
    ActionType,
    AssignDuelScoring,
    Breed,
    Cannibalize,
    Habitats,
    InsectKind,
    Jump,
    LocustPreferenceDefinition,
    MachineState,
    PlaceCube,
    RelocateLocusts,
    Swarm,
    breedableHabitatIds,
    cannibalizableHabitatIds,
    requiredVictims,
    cannibalizeError,
    evenVictims,
    habitatNeighbors,
    jumpError,
    legalCubeSpaceIds,
    relocationError,
    requiredRelocations,
    swarmableHabitatIds,
    type Attack,
    type Hop,
    type LocustGameState,
    type HydratedLocustGameState,
    type LocustPreferences,
    type PendingAction
} from '@tabletop/locust'

export enum JumpOrBreedMode {
    Jump = 'jump',
    Breed = 'breed'
}

export class LocustGameSession extends GameSession<LocustGameState, HydratedLocustGameState> {
    lastActionError: string | undefined = $state()

    useAlternative = $state(false)
    hopOrigin: string | undefined = $state()
    hops: Hop[] = $state([])
    breedHabitatIds: string[] = $state([])
    attacks: Attack[] = $state([])
    pickingAttack: Attack | undefined = $state()
    swarmHabitatIds: string[] = $state([])
    relocationDestinations: string[] = $state([])

    readonly preferences: TitlePreferences<typeof LocustPreferences> = this.createPreferences(
        LocustPreferenceDefinition
    )

    canAct = $derived(this.validActionTypes.length > 0 && !this.isViewingHistory)

    // GameSession.applyAction ignores actions while a previous one is still being shown, so clicks
    // in that window must not build a selection that could never be submitted.
    private get acceptingInput(): boolean {
        return this.canAct && !this.busy
    }

    pendingAction: PendingAction | undefined = $derived(this.gameState.pendingAction)

    actingColor: Color | undefined = $derived.by(() => {
        if (this.gameState.machineState === MachineState.RelocateLocusts) {
            return this.gameState.swarm?.relocators[0]
        }
        return this.gameState.activeColor
    })

    choosableSpaceIds: string[] = $derived.by(() =>
        this.canAct && this.gameState.machineState === MachineState.ChooseSpace
            ? legalCubeSpaceIds(this.gameState)
            : []
    )

    performKind: ActionKind | undefined = $derived(
        this.canAct && this.gameState.machineState === MachineState.PerformAction
            ? this.pendingAction?.kind
            : undefined
    )

    isRelocating = $derived(
        this.canAct && this.gameState.machineState === MachineState.RelocateLocusts
    )

    requiredRelocationCount = $derived.by(() => {
        const swarm = this.gameState.swarm
        const color = this.actingColor
        if (!this.isRelocating || !swarm || !color) {
            return 0
        }
        return requiredRelocations(this.gameState, color, swarm.habitatId)
    })

    // The first click decides the JUMP/BREED action: a grasshopper starts a jump, a nymph circle a breed.
    jumpOrBreedMode: JumpOrBreedMode | undefined = $derived(
        this.hopOrigin !== undefined || this.hops.length > 0
            ? JumpOrBreedMode.Jump
            : this.breedHabitatIds.length > 0
              ? JumpOrBreedMode.Breed
              : undefined
    )

    jumpOriginIds: string[] = $derived.by(() => {
        const color = this.actingColor
        const pending = this.pendingAction
        if (
            !color ||
            !pending ||
            this.performKind !== ActionKind.JumpOrBreed ||
            this.jumpOrBreedMode === JumpOrBreedMode.Breed ||
            this.hopOrigin !== undefined ||
            this.hops.length >= pending.level
        ) {
            return []
        }
        return Habitats.map((habitat) => habitat.id).filter((from) =>
            habitatNeighbors(from).some(
                (to) => !jumpError(this.gameState, color, pending, [...this.hops, { from, to }])
            )
        )
    })

    breedTargetIds: string[] = $derived.by(() => {
        const color = this.actingColor
        const pending = this.pendingAction
        if (
            !color ||
            !pending ||
            this.performKind !== ActionKind.JumpOrBreed ||
            this.jumpOrBreedMode === JumpOrBreedMode.Jump
        ) {
            return []
        }
        const limit = Math.min(pending.level, this.gameState.colony(color).supply)
        return this.breedHabitatIds.length < limit
            ? breedableHabitatIds(this.gameState, color, pending)
            : []
    })

    selectableHabitatIds: string[] = $derived.by(() => {
        const color = this.actingColor
        const pending = this.pendingAction
        if (!color) {
            return []
        }
        if (this.isRelocating) {
            return this.relocationTargets()
        }
        if (!pending) {
            return []
        }
        switch (this.performKind) {
            case ActionKind.JumpOrBreed:
                return this.jumpDestinations(color, pending)
            case ActionKind.Cannibalize:
                return this.attacks.length >= pending.level || this.pickingAttack
                    ? []
                    : cannibalizableHabitatIds(this.gameState, color).filter(
                          (habitatId) =>
                              !this.attacks.some((attack) => attack.habitatId === habitatId) &&
                              requiredVictims(this.gameState, color, habitatId) > 0
                      )
            case ActionKind.Swarm:
                return this.swarmHabitatIds.length >= pending.level
                    ? []
                    : swarmableHabitatIds(this.gameState).filter(
                          (habitatId) => !this.swarmHabitatIds.includes(habitatId)
                      )
            default:
                return []
        }
    })

    draftError: string | undefined = $derived.by(() => {
        const color = this.actingColor
        const pending = this.pendingAction
        if (!color) {
            return undefined
        }
        if (this.isRelocating && this.gameState.swarm) {
            return relocationError(
                this.gameState,
                color,
                this.gameState.swarm.habitatId,
                this.relocationDestinations
            )
        }
        if (this.performKind === ActionKind.Cannibalize && pending) {
            return cannibalizeError(this.gameState, color, pending, this.attacks)
        }
        return undefined
    })

    hasManualSelection = $derived(
        this.hopOrigin !== undefined ||
            this.hops.length > 0 ||
            this.breedHabitatIds.length > 0 ||
            this.attacks.length > 0 ||
            this.pickingAttack !== undefined ||
            this.swarmHabitatIds.length > 0 ||
            this.relocationDestinations.length > 0
    )

    private jumpDestinations(color: Color, pending: PendingAction): string[] {
        const origin = this.hopOrigin
        if (!origin) {
            return []
        }
        return habitatNeighbors(origin).filter(
            (to) => !jumpError(this.gameState, color, pending, [...this.hops, { from: origin, to }])
        )
    }

    private relocationTargets(): string[] {
        const swarm = this.gameState.swarm
        if (!swarm || this.relocationDestinations.length >= this.requiredRelocationCount) {
            return []
        }
        return Habitats.map((habitat) => habitat.id).filter((habitatId) =>
            this.hasRelocationRoom(habitatId, swarm.habitatId)
        )
    }

    private hasRelocationRoom(habitatId: string, sourceId: string): boolean {
        if (habitatId === sourceId) {
            return false
        }
        const alreadyChosen = this.relocationDestinations.filter(
            (chosen) => chosen === habitatId
        ).length
        return this.gameState.freeRoom(habitatId) - alreadyChosen > 0
    }

    resetAction() {
        this.useAlternative = false
        this.clearLocalSelection()
    }

    clearLocalSelection() {
        this.hopOrigin = undefined
        this.hops = []
        this.breedHabitatIds = []
        this.attacks = []
        this.pickingAttack = undefined
        this.swarmHabitatIds = []
        this.relocationDestinations = []
        this.lastActionError = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    override async undo() {
        if (this.hasManualSelection) {
            this.clearLocalSelection()
            return
        }
        await super.undo()
    }

    async selectGrasshopper(habitatId: string) {
        if (!this.acceptingInput) {
            return
        }
        if (this.hopOrigin === habitatId) {
            this.hopOrigin = undefined
            return
        }
        if (this.jumpOriginIds.includes(habitatId)) {
            this.hopOrigin = habitatId
        }
    }

    async selectNymphCircle(habitatId: string) {
        if (!this.acceptingInput) {
            return
        }
        if (!this.breedTargetIds.includes(habitatId)) {
            return
        }
        this.breedHabitatIds = [...this.breedHabitatIds, habitatId]
        await this.submitWhenComplete()
    }

    async selectHabitat(habitatId: string) {
        if (!this.acceptingInput) {
            return
        }
        if (this.pickingAttack) {
            return
        }
        if (!this.selectableHabitatIds.includes(habitatId)) {
            return
        }
        if (this.isRelocating) {
            this.relocationDestinations = [...this.relocationDestinations, habitatId]
            if (this.relocationDestinations.length >= this.requiredRelocationCount) {
                await this.submitRelocation()
            }
            return
        }
        switch (this.performKind) {
            case ActionKind.JumpOrBreed:
                if (this.hopOrigin) {
                    this.hops = [...this.hops, { from: this.hopOrigin, to: habitatId }]
                    this.hopOrigin = undefined
                }
                break
            case ActionKind.Cannibalize:
                this.startAttack(habitatId)
                break
            case ActionKind.Swarm:
                this.swarmHabitatIds = [...this.swarmHabitatIds, habitatId]
                break
        }
        await this.submitWhenComplete()
    }

    // Multi-step actions commit by themselves once nothing more can be added; "End action" stops early.
    private async submitWhenComplete() {
        if (!this.hasManualSelection || this.hopOrigin !== undefined || this.pickingAttack) {
            return
        }
        const nothingLeft =
            this.performKind === ActionKind.JumpOrBreed
                ? this.jumpOriginIds.length === 0 && this.breedTargetIds.length === 0
                : this.selectableHabitatIds.length === 0
        if (nothingLeft) {
            await this.endAction()
        }
    }

    private startAttack(habitatId: string) {
        const color = this.actingColor
        if (!color) {
            return
        }
        if (hasVictimChoice(this.gameState, color, habitatId)) {
            this.pickingAttack = { habitatId, victims: [] }
            return
        }
        this.attacks = [...this.attacks, { habitatId, victims: evenVictims(this.gameState, color, habitatId) }]
    }

    victimChoices: VictimOption[] = $derived.by(() => {
        const picking = this.pickingAttack
        const color = this.actingColor
        return picking && color ? victimOptions(this.gameState, color, picking.habitatId, picking.victims) : []
    })

    async pickVictim(color: Color, kind: InsectKind) {
        if (!this.acceptingInput) {
            return
        }
        const picking = this.pickingAttack
        if (!picking || !this.victimChoices.some((option) => option.color === color && option.kind === kind)) {
            return
        }
        const updated = { habitatId: picking.habitatId, victims: addVictim(picking.victims, color, kind) }
        this.pickingAttack = updated
        if (this.victimChoices.length === 0) {
            this.attacks = [...this.attacks, updated]
            this.pickingAttack = undefined
            await this.submitWhenComplete()
        }
    }

    private async submit(actionType: ActionType, build: () => Promise<void>) {
        if (!this.validActionTypes.includes(actionType)) {
            return
        }
        this.lastActionError = undefined
        try {
            await build()
        } catch (error) {
            this.lastActionError = error instanceof Error ? error.message : String(error)
        }
    }

    async chooseSpace(spaceId: string) {
        if (!this.acceptingInput) {
            return
        }
        if (!this.choosableSpaceIds.includes(spaceId)) {
            return
        }
        const alternative = this.useAlternative && this.gameState.isAlternativeActionAvailable()
        await this.submit(ActionType.PlaceCube, async () => {
            await this.applyAction(this.createPlayerAction(PlaceCube, { spaceId, alternative }))
        })
    }

    async endAction() {
        if (!this.acceptingInput) {
            return
        }
        this.hopOrigin = undefined
        this.pickingAttack = undefined
        switch (this.performKind) {
            case ActionKind.JumpOrBreed:
                if (this.jumpOrBreedMode === JumpOrBreedMode.Breed) {
                    const habitatIds = this.breedHabitatIds
                    await this.submit(ActionType.Breed, async () => {
                        await this.applyAction(this.createPlayerAction(Breed, { habitatIds }))
                    })
                } else {
                    const hops = this.hops
                    await this.submit(ActionType.Jump, async () => {
                        await this.applyAction(this.createPlayerAction(Jump, { hops }))
                    })
                }
                return
            case ActionKind.Cannibalize: {
                const attacks = this.attacks
                await this.submit(ActionType.Cannibalize, async () => {
                    await this.applyAction(this.createPlayerAction(Cannibalize, { attacks }))
                })
                return
            }
            case ActionKind.Swarm: {
                const habitatIds = this.swarmHabitatIds
                await this.submit(ActionType.Swarm, async () => {
                    await this.applyAction(this.createPlayerAction(Swarm, { habitatIds }))
                })
                return
            }
        }
    }

    private async submitRelocation() {
        const destinations = this.relocationDestinations
        await this.submit(ActionType.RelocateLocusts, async () => {
            await this.applyAction(this.createPlayerAction(RelocateLocusts, { destinations }))
        })
    }

    async assignVigorColor(vigorColor: Color) {
        await this.submit(ActionType.AssignDuelScoring, async () => {
            await this.applyAction(this.createPlayerAction(AssignDuelScoring, { vigorColor }))
        })
    }
}
