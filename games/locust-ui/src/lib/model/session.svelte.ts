import { GameSession, TitlePreferences } from '@tabletop/frontend-components'
import type { Color } from '@tabletop/common'
import {
    ActionKind,
    ActionType,
    AssignDuelScoring,
    Breed,
    Cannibalize,
    Habitats,
    Hatch,
    InsectKind,
    Jump,
    LocustPreferenceDefinition,
    MachineState,
    PlaceCube,
    RelocateLocusts,
    Swarm,
    breedableHabitatIds,
    cannibalizableHabitatIds,
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
    jumpOrBreedMode: JumpOrBreedMode = $state(JumpOrBreedMode.Jump)
    hopOrigin: string | undefined = $state()
    hops: Hop[] = $state([])
    breedHabitatIds: string[] = $state([])
    hatchCount = $state(0)
    attacks: Attack[] = $state([])
    swarmHabitatIds: string[] = $state([])
    relocationDestinations: string[] = $state([])

    readonly preferences: TitlePreferences<typeof LocustPreferences> =
        this.createPreferences(LocustPreferenceDefinition)

    canAct = $derived(this.validActionTypes.length > 0 && !this.isViewingHistory)

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

    isRelocating = $derived(this.canAct && this.gameState.machineState === MachineState.RelocateLocusts)

    requiredRelocationCount = $derived.by(() => {
        const swarm = this.gameState.swarm
        const color = this.actingColor
        if (!this.isRelocating || !swarm || !color) {
            return 0
        }
        return requiredRelocations(this.gameState, color, swarm.habitatId)
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
                return this.jumpOrBreedMode === JumpOrBreedMode.Jump
                    ? this.jumpTargets(color, pending)
                    : this.breedTargets(color, pending)
            case ActionKind.Cannibalize:
                return cannibalizableHabitatIds(this.gameState, color).filter(
                    (habitatId) =>
                        this.attacks.some((attack) => attack.habitatId === habitatId) ||
                        this.attacks.length < pending.level
                )
            case ActionKind.Swarm:
                return swarmableHabitatIds(this.gameState).filter(
                    (habitatId) =>
                        this.swarmHabitatIds.includes(habitatId) ||
                        this.swarmHabitatIds.length < pending.level
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
            return relocationError(this.gameState, color, this.gameState.swarm.habitatId, this.relocationDestinations)
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
            this.hatchCount > 0 ||
            this.attacks.length > 0 ||
            this.swarmHabitatIds.length > 0 ||
            this.relocationDestinations.length > 0
    )

    private jumpTargets(color: Color, pending: PendingAction): string[] {
        if (this.hops.length >= pending.level) {
            return []
        }
        if (this.hopOrigin) {
            const origin = this.hopOrigin
            return habitatNeighbors(origin).filter(
                (to) => !jumpError(this.gameState, color, pending, [...this.hops, { from: origin, to }])
            )
        }
        return Habitats.map((habitat) => habitat.id).filter((from) =>
            habitatNeighbors(from).some(
                (to) => !jumpError(this.gameState, color, pending, [...this.hops, { from, to }])
            )
        )
    }

    private breedTargets(color: Color, pending: PendingAction): string[] {
        const limit = Math.min(pending.level, this.gameState.colony(color).supply)
        return this.breedHabitatIds.length < limit
            ? breedableHabitatIds(this.gameState, color, pending)
            : []
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
        const alreadyChosen = this.relocationDestinations.filter((chosen) => chosen === habitatId).length
        return this.gameState.freeRoom(habitatId) - alreadyChosen > 0
    }

    resetAction() {
        this.useAlternative = false
        this.jumpOrBreedMode = JumpOrBreedMode.Jump
        this.clearLocalSelection()
    }

    clearLocalSelection() {
        this.hopOrigin = undefined
        this.hops = []
        this.breedHabitatIds = []
        this.hatchCount = 0
        this.attacks = []
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

    setJumpOrBreedMode(mode: JumpOrBreedMode) {
        this.jumpOrBreedMode = mode
        this.clearLocalSelection()
    }

    selectHabitat(habitatId: string) {
        if (!this.selectableHabitatIds.includes(habitatId) && this.hopOrigin !== habitatId) {
            return
        }
        if (this.isRelocating) {
            this.relocationDestinations = [...this.relocationDestinations, habitatId]
            return
        }
        switch (this.performKind) {
            case ActionKind.JumpOrBreed:
                if (this.jumpOrBreedMode === JumpOrBreedMode.Breed) {
                    this.breedHabitatIds = [...this.breedHabitatIds, habitatId]
                } else if (this.hopOrigin === habitatId) {
                    this.hopOrigin = undefined
                } else if (this.hopOrigin) {
                    this.hops = [...this.hops, { from: this.hopOrigin, to: habitatId }]
                    this.hopOrigin = undefined
                } else {
                    this.hopOrigin = habitatId
                }
                return
            case ActionKind.Cannibalize:
                this.toggleAttack(habitatId)
                return
            case ActionKind.Swarm:
                this.swarmHabitatIds = this.swarmHabitatIds.includes(habitatId)
                    ? this.swarmHabitatIds.filter((chosen) => chosen !== habitatId)
                    : [...this.swarmHabitatIds, habitatId]
                return
        }
    }

    private toggleAttack(habitatId: string) {
        const color = this.actingColor
        if (!color) {
            return
        }
        this.attacks = this.attacks.some((attack) => attack.habitatId === habitatId)
            ? this.attacks.filter((attack) => attack.habitatId !== habitatId)
            : [...this.attacks, { habitatId, victims: evenVictims(this.gameState, color, habitatId) }]
    }

    adjustVictim(habitatId: string, color: Color, kind: InsectKind, change: number) {
        this.attacks = this.attacks.map((attack) => {
            if (attack.habitatId !== habitatId) {
                return attack
            }
            const existing = attack.victims.find((victim) => victim.color === color && victim.kind === kind)
            const count = Math.max(0, (existing?.count ?? 0) + change)
            const others = attack.victims.filter((victim) => victim !== existing)
            return { habitatId, victims: count > 0 ? [...others, { color, kind, count }] : others }
        })
    }

    setHatchCount(count: number) {
        this.hatchCount = count
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
        if (!this.choosableSpaceIds.includes(spaceId)) {
            return
        }
        const alternative = this.useAlternative && this.gameState.isAlternativeActionAvailable()
        await this.submit(ActionType.PlaceCube, async () => {
            await this.applyAction(this.createPlayerAction(PlaceCube, { spaceId, alternative }))
        })
    }

    async confirmAction() {
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
            case ActionKind.Hatch: {
                const count = this.hatchCount
                await this.submit(ActionType.Hatch, async () => {
                    await this.applyAction(this.createPlayerAction(Hatch, { count }))
                })
                return
            }
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

    async doNothing() {
        this.clearLocalSelection()
        await this.confirmAction()
    }

    async confirmRelocation() {
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
