<script lang="ts">
    import {
        ActionType,
        BoardBoxLocations,
        BoardNodesById,
        CardKind,
        CompanyNames,
        DragonHuntRegion,
        RegionIds,
        RegionNames,
        StatKind,
        cardActionsFor,
        getCard,
        type CompanyId,
        type RegionId
    } from '@tabletop/rocky-ventures'
    import type { GameAction } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import { GridRegion, gridCellPosition } from '$lib/utils/trackLayout.js'
    import { regionLabelPoint } from '$lib/utils/regionMap.js'
    import { cardActionText } from '$lib/utils/cardActionText.js'

    // Live play: the watcher box. While someone else plays it keeps their selected card up until the turn
    // is done, zooms into the map for what they're choosing or just did, and lists each step in words.
    // The player themselves only sees their card pulse.
    const gameSession = getGameSession()

    type Zoom = { x: number; y: number; width: number; height: number }
    type Step = { text: string; zoom?: Zoom }

    const ZoomAspect = 4 / 3

    const activeId = $derived(gameSession.gameState.activePlayerIds[0])
    const watching = $derived(gameSession.livePlay && !gameSession.isMyTurn && !gameSession.isViewingHistory && activeId !== undefined)
    const name = $derived(activeId ? gameSession.getPlayerName(activeId) : '')

    function cardUrl(cardId: string | undefined): string | undefined {
        if (!cardId) return undefined
        try {
            return getCard(cardId).kind === CardKind.Player
                ? playerCardImageUrl(cardId, activeId ? gameSession.colors.getPlayerColor(activeId) : undefined)
                : cardImageUrl(cardId)
        } catch {
            return undefined
        }
    }

    // A 4:3 window on the board around some points, never tighter than minWidth.
    function around(points: { x: number; y: number }[], minWidth = 420): Zoom | undefined {
        if (!points.length) return undefined
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)
        const pad = 90
        let width = Math.max(minWidth, Math.max(...xs) - Math.min(...xs) + pad * 2)
        let height = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, width / ZoomAspect)
        width = Math.max(width, height * ZoomAspect)
        height = width / ZoomAspect
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2
        const cy = (Math.max(...ys) + Math.min(...ys)) / 2
        return { x: cx - width / 2, y: cy - height / 2, width, height }
    }

    function nodePoint(nodeId: string | undefined) {
        const node = nodeId ? BoardNodesById[nodeId] : undefined
        return node ? [{ x: node.x, y: node.y }] : []
    }

    function regionName(region: string): string {
        if (region === DragonHuntRegion) return 'the Dragon'
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? RegionNames[id] : region
    }

    function regionZoom(region: string): Zoom | undefined {
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? around([regionLabelPoint(id as RegionId)], 520) : undefined
    }

    function gridZoom(): Zoom | undefined {
        const player = activeId ? gameSession.gameState.findPlayerState(activeId) : undefined
        if (!player) return undefined
        const cell = gridCellPosition(player.weaponLevel, player.toolLevel)
        const width = GridRegion.width
        return { x: cell.x - width / 2, y: cell.y - width / ZoomAspect / 2, width, height: width / ZoomAspect }
    }

    function money(amount: number): string {
        return amount < 0 ? `-$${-amount}` : `+$${amount}`
    }

    // This turn's actions by the active player, oldest first.
    const turn = $derived.by(() => {
        const actions: GameAction[] = []
        if (!watching || !activeId) return actions
        for (const action of [...gameSession.actions].reverse()) {
            if (action.playerId && action.playerId !== activeId) break
            actions.unshift(action)
            if (action.type === ActionType.MovePawn) break
        }
        return actions
    })

    const selectedCardId = $derived.by(() => {
        if (!turn.some((action) => action.type === ActionType.MovePawn)) return undefined
        const player = activeId ? gameSession.gameState.findPlayerState(activeId) : undefined
        return player && player.pawnIndex !== undefined ? player.tableau[player.pawnIndex] : undefined
    })

    // The actions on a card in short words, e.g. "Tax or Invest" for a card that offers one of them.
    function cardActions(cardId: string | undefined): string | undefined {
        if (!cardId) return undefined
        try {
            const card = getCard(cardId)
            if (card.kind !== CardKind.Player && card.kind !== CardKind.Development) return undefined
            const names = cardActionsFor(card, gameSession.gameState.revisedCards).map((action) => cardActionText(action).split(':')[0])
            if (!names.length) return undefined
            const exclusive = card.kind === CardKind.Player && card.exclusiveActions
            return exclusive ? names.join(' or ') : names.join(', then ')
        } catch {
            return undefined
        }
    }

    const selectedActions = $derived(cardActions(selectedCardId))

    const steps = $derived.by((): Step[] => {
        const state = gameSession.gameState
        const turnStart = state.actionCount - turn.length
        const extracts = state.statEvents.filter((event) => event.kind === StatKind.MineExtract && event.playerId === activeId && event.action >= turnStart)
        const player = activeId ? state.findPlayerState(activeId) : undefined
        let extractIndex = 0
        let huntRegion = ''
        return turn.flatMap((action): Step[] => {
            const data = action as GameAction & Record<string, unknown>
            switch (action.type) {
                case ActionType.MovePawn:
                    return [{ text: selectedActions ? `selected ${selectedActions}` : 'selected a card' }]
                case ActionType.Invest:
                    return [{ text: 'bought a card' }]
                case ActionType.Tax:
                    return [{ text: 'taxed' }]
                case ActionType.ClaimMine:
                    return [{ text: `claimed ${BoardNodesById[data.nodeId as string]?.name ?? 'a mine'}`, zoom: around(nodePoint(data.nodeId as string)) }]
                case ActionType.LayTrack:
                case ActionType.LayFreeTrack: {
                    const location = BoardBoxLocations.find((candidate) => candidate.box.id === data.boxId)
                    const company = data.companyId ? CompanyNames[data.companyId as CompanyId] : undefined
                    return [{ text: `laid ${company ? `${company} ` : ''}track`, zoom: location ? around([location]) : undefined }]
                }
                case ActionType.ExtractAndSell: {
                    const event = extracts[extractIndex++]
                    const detail = Object.fromEntries((event?.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string]))
                    const ore = event?.source === 'gold' ? 'Gold' : event?.source === 'silver' ? 'Silver' : 'ore'
                    const mine = BoardNodesById[data.nodeId as string]?.name ?? 'a mine'
                    const city = BoardNodesById[detail['city'] ?? '']?.name
                    const route = (gameSession.turnMarks.routes.find((nodes) => nodes[0] === data.nodeId) ?? [data.nodeId as string]).flatMap(nodePoint)
                    return [
                        {
                            text: `delivered ${detail['ore'] ?? ''} ${ore} from ${mine}${city ? ` to ${city}` : ''}${event ? `: ${money(event.amount)}` : ''}`.replace('  ', ' '),
                            zoom: around(route)
                        }
                    ]
                }
                case ActionType.Hunt:
                    huntRegion = data.region as string
                    return [{ text: `hunted ${regionName(huntRegion)}`, zoom: regionZoom(huntRegion) }]
                case ActionType.ResolveHunt: {
                    const hits = (data.hitTargets as string[] | undefined)?.length ?? 0
                    return [{ text: hits ? `hit ${hits} ${hits === 1 ? 'time' : 'times'}` : 'missed', zoom: regionZoom(huntRegion) }]
                }
                case ActionType.Acquire: {
                    const choice = data.choice as 'weapon' | 'tool'
                    const level = choice === 'weapon' ? player?.weaponLevel : player?.toolLevel
                    return [{ text: `raised ${choice} to ${level}`, zoom: gridZoom() }]
                }
                case ActionType.ChooseShare:
                    return [{ text: `took a ${CompanyNames[data.companyId as CompanyId] ?? ''} share` }]
                case ActionType.GemAction:
                    return [{ text: 'used a gem' }]
                case ActionType.AgreementPointBuy:
                    return [{ text: data.buy ? 'bought VP from the agreement' : 'skipped the agreement VP' }]
                default:
                    return []
            }
        })
    })

    // What to zoom into: what they're choosing right now, else the last thing they did with a place on the map.
    const focus = $derived.by((): Step | undefined => {
        const selection = watching ? gameSession.watchedSelection : undefined
        if (selection) {
            const mineId = selection.extractHoverNodeId ?? selection.extractNodeId
            if (mineId) {
                const nodes = [mineId, ...gameSession.watchedRoutePreviews.flatMap((preview) => preview.routeNodeIds)]
                return { text: `is choosing a delivery from ${BoardNodesById[mineId]?.name ?? 'a mine'}`, zoom: around(nodes.flatMap(nodePoint)) }
            }
            if (selection.acquireMode || selection.step === 'Acquire') return { text: 'is picking a level', zoom: gridZoom() }
            if (selection.step === 'Hunt') return { text: 'is picking weapon tokens' }
        }
        return [...steps].reverse().find((step) => step.zoom)
    })

    const lookingAtId = $derived(watching && gameSession.mirroring ? gameSession.watchedSelection?.lookingAtCardId : undefined)
    const shownCardId = $derived(lookingAtId ?? selectedCardId)
    const shownCardUrl = $derived(cardUrl(shownCardId))
</script>

{#if watching && (shownCardUrl || focus?.zoom || steps.length)}
    <div class="pointer-events-none fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border-2 border-[#ffd166] bg-[#1b140c]/95 p-2 text-xs text-[#f1e6cf] shadow-2xl">
        {#if shownCardUrl}
            <div><strong class="capitalize">{name}</strong> {lookingAtId && lookingAtId !== selectedCardId ? 'is looking at' : 'selected'}</div>
            {#if (!lookingAtId || lookingAtId === selectedCardId) && selectedActions}
                <div class="text-center text-base font-bold text-[#ffd166]">{selectedActions}</div>
            {/if}
            <img src={shownCardUrl} alt={shownCardId} class="mx-auto {focus?.zoom ? 'h-40' : 'h-56'} w-auto rounded-lg max-sm:h-28" draggable="false" />
        {/if}
        {#if focus?.zoom}
            <div><strong class="capitalize">{name}</strong> {focus.text}</div>
            <svg viewBox="{focus.zoom.x} {focus.zoom.y} {focus.zoom.width} {focus.zoom.height}" class="block aspect-[4/3] w-full rounded-lg border border-[#8a6d3b] bg-black" xmlns="http://www.w3.org/2000/svg">
                <use href="#rv-board-svg" />
            </svg>
        {:else if focus}
            <div><strong class="capitalize">{name}</strong> {focus.text}</div>
        {/if}
        {#if steps.length}
            <ol class="flex flex-col gap-0.5 border-t border-[#8a6d3b] pt-1">
                {#each steps as step, index (index)}
                    <li class={index === steps.length - 1 ? 'font-semibold text-[#ffd166]' : 'text-[#c9a961]'}>{index + 1}. {step.text}</li>
                {/each}
            </ol>
        {/if}
    </div>
{/if}
