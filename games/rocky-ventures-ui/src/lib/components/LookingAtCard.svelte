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
        type WeaponTokenKind,
        type RegionId
    } from '@tabletop/rocky-ventures'
    import type { GameAction } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import { GridRegion, gridCellPosition, victoryPointPosition } from '$lib/utils/trackLayout.js'
    import { regionLabelPoint } from '$lib/utils/regionMap.js'
    import { cardActionText } from '$lib/utils/cardActionText.js'
    import { weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { recentOtherPlayerAction } from '$lib/utils/recentAction.js'
    import { shareImageUrl } from '$lib/utils/shareImages.js'
    import { tick } from 'svelte'

    // Live play: the watcher box. While someone else plays it keeps their selected card up until the turn
    // is done, zooms into the map for what they're choosing or just did, and lists each step in words.
    // The player themselves only sees their card pulse.
    const gameSession = getGameSession()

    type Zoom = { x: number; y: number; width: number; height: number }
    type Step = { text: string; detail?: string; zoom?: Zoom; imageUrl?: string; tokens?: { kind: string; picked: boolean }[]; live?: boolean }

    const ZoomAspect = 4 / 3

    const activeId = $derived(gameSession.gameState.activePlayerIds[0])
    const watching = $derived(gameSession.livePlay && !gameSession.isMyTurn && !gameSession.isViewingHistory && activeId !== undefined)
    // Whose history to show: the player on turn, or until they start, the player who just finished,
    // so the last turn's summary stays up instead of vanishing the moment the turn passes.
    const actorId = $derived.by(() => {
        const last = gameSession.actions.at(-1)
        const started = last?.playerId === activeId || gameSession.watchedSelection !== undefined || gameSession.gameState.pendingHunt !== undefined
        if (started || !last?.playerId || last.playerId === gameSession.myPlayer?.id) return activeId
        return last.playerId
    })
    const name = $derived(actorId ? gameSession.getPlayerName(actorId) : '')

    function cardUrl(cardId: string | undefined): string | undefined {
        if (!cardId) return undefined
        try {
            return getCard(cardId).kind === CardKind.Player
                ? playerCardImageUrl(cardId, actorId ? gameSession.colors.getPlayerColor(actorId) : undefined)
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
        const player = actorId ? gameSession.gameState.findPlayerState(actorId) : undefined
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
        if (!watching || !actorId) return actions
        for (const action of [...gameSession.actions].reverse()) {
            if (action.playerId && action.playerId !== actorId) break
            actions.unshift(action)
            if (action.type === ActionType.MovePawn) break
        }
        return actions
    })

    const selectedCardId = $derived.by(() => {
        if (!turn.some((action) => action.type === ActionType.MovePawn)) return undefined
        const player = actorId ? gameSession.gameState.findPlayerState(actorId) : undefined
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

    // What the latest hunt this turn paid out, e.g. "+2 VP, +$3".
    const huntBonus = $derived.by(() => {
        if (!turn.some((action) => action.type === ActionType.ResolveHunt) || !actorId) return undefined
        const recent = recentOtherPlayerAction(gameSession, ActionType.ResolveHunt, { includeMine: true })
        if (!recent) return undefined
        const before = recent.before.getPlayerState(actorId)
        const after = recent.after.getPlayerState(actorId)
        const gain = (amount: number, text: (n: number) => string) => (amount > 0 ? text(amount) : undefined)
        const tokenIndexes = (recent.action as GameAction & { tokenIndexes?: number[] }).tokenIndexes ?? []
        const tokens = (recent.before.pendingHunt?.drawn ?? []).map((kind, index) => ({ kind: kind as string, picked: tokenIndexes.includes(index) }))
        const text = [
            gain(after.victoryPoints - before.victoryPoints, (n) => `${n} VP`),
            gain(after.money - before.money, (n) => `$${n}`),
            gain(after.gems - before.gems, (n) => `${n} ${n === 1 ? 'gem' : 'gems'}`),
            gain(after.weaponLevel - before.weaponLevel, (n) => `${n} weapon ${n === 1 ? 'level' : 'levels'}`)
        ]
            .filter((part) => part !== undefined)
            .join(', ')
        return { text, tokens, region: recent.before.pendingHunt?.region, hitsFrom: before.huntHits ?? 0, hitsTo: after.huntHits ?? 0 }
    })

    function huntStep(region: string): Step {
        return { text: region === DragonHuntRegion ? 'hunt the Dragon' : `hunt in ${regionName(region)}`, zoom: regionZoom(region) }
    }

    const steps = $derived.by((): Step[] => {
        const state = gameSession.gameState
        const turnStart = state.actionCount - turn.length
        const ofKind = (kind: StatKind) => state.statEvents.filter((event) => event.kind === kind && event.playerId === actorId && event.action >= turnStart)
        const extracts = ofKind(StatKind.MineExtract)
        const claims = ofKind(StatKind.MineClaim)
        const purchases = ofKind(StatKind.Purchase)
        const player = actorId ? state.findPlayerState(actorId) : undefined
        let extractIndex = 0
        let claimIndex = 0
        let purchaseIndex = 0
        let huntRegion = ''
        return turn.flatMap((action): Step[] => {
            const data = action as GameAction & Record<string, unknown>
            switch (action.type) {
                case ActionType.MovePawn:
                    return [{ text: selectedActions ? `selected ${selectedActions}` : 'selected a card', imageUrl: cardUrl(selectedCardId) }]
                case ActionType.Invest: {
                    const cardId = purchases[purchaseIndex++]?.cardId
                    return [{ text: 'bought a card', imageUrl: cardUrl(cardId) }]
                }
                case ActionType.Tax:
                    return [{ text: 'taxed', imageUrl: cardUrl(player?.tuckedCardIds.at(-1)) }]
                case ActionType.ClaimMine: {
                    const cost = claims[claimIndex++]?.amount
                    return [{ text: `claimed ${BoardNodesById[data.nodeId as string]?.name ?? 'a mine'}${cost === undefined ? '' : ` for $${cost}`}`, zoom: around(nodePoint(data.nodeId as string)) }]
                }
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
                    return [huntStep(huntRegion)]
                case ActionType.ResolveHunt: {
                    const hits = (data.hitTargets as string[] | undefined)?.length ?? 0
                    const bonus = huntBonus?.text ? ` and claimed ${huntBonus.text}` : ''
                    // A hunt that came with a claim has no Hunt step of its own, so name the region first.
                    const region = huntRegion || huntBonus?.region || ''
                    const lead: Step[] = huntRegion || !region ? [] : [huntStep(region)]
                    huntRegion = ''
                    // Battle axe rule: the hit marker climbs the score track.
                    const axe: Step[] =
                        gameSession.gameState.huntHitsScoreAtFeasts && huntBonus && huntBonus.hitsTo > huntBonus.hitsFrom
                            ? [{ text: `moved the battle axe up to ${huntBonus.hitsTo} ${huntBonus.hitsTo === 1 ? 'hit' : 'hits'}`, zoom: around([victoryPointPosition(huntBonus.hitsFrom), victoryPointPosition(huntBonus.hitsTo)], 360) }]
                            : []
                    return [
                        ...lead,{ text: hits ? `applied ${hits} ${hits === 1 ? 'hit' : 'hits'}${bonus}` : `missed${bonus}`, tokens: huntBonus?.tokens }, ...axe]
                }
                case ActionType.Acquire: {
                    const choice = data.choice as 'weapon' | 'tool'
                    const level = choice === 'weapon' ? player?.weaponLevel : player?.toolLevel
                    return [{ text: `raised ${choice} to ${level}`, zoom: gridZoom() }]
                }
                case ActionType.ChooseShare: {
                    const companyId = data.companyId as CompanyId
                    const company = state.getCompany(companyId)
                    const index = Math.max(0, company.nextShareIndex - 1)
                    return [{ text: `took a ${CompanyNames[companyId] ?? ''} share (${company.multiplierForShare(index)}x)`, imageUrl: shareImageUrl(companyId, index, company.sharesFlipped) }]
                }
                case ActionType.GemAction:
                    return [{ text: 'used a gem' }]
                case ActionType.AgreementPointBuy:
                    return [{ text: data.buy ? 'bought VP from the agreement' : 'skipped the agreement VP' }]
                default:
                    return []
            }
        })
    })

    // The entry at the bottom of the history: what they're doing right now, before it's committed.
    const live = $derived.by((): Step | undefined => {
        if (!watching || actorId !== activeId) return undefined
        const pending = gameSession.gameState.pendingHunt
        const selection = gameSession.watchedSelection
        if (pending) {
            const picked = selection?.huntSelected ?? []
            return {
                text: `${pending.region === DragonHuntRegion ? 'hunts the Dragon' : `hunts in ${regionName(pending.region)}`}`,
                detail: `Drew ${pending.drawn.length} weapon ${pending.drawn.length === 1 ? 'token' : 'tokens'}, applies up to ${pending.apply}`,
                tokens: pending.drawn.map((kind, index) => ({ kind: kind as string, picked: picked.includes(index) })),
                live: true
            }
        }
        if (!selection) return undefined
        const mineId = selection.extractHoverNodeId ?? selection.extractNodeId
        if (mineId) {
            const nodes = [mineId, ...gameSession.watchedRoutePreviews.flatMap((preview) => preview.routeNodeIds)]
            return { text: `is choosing a delivery from ${BoardNodesById[mineId]?.name ?? 'a mine'}`, zoom: around(nodes.flatMap(nodePoint)), live: true }
        }
        if (selection.acquireMode || selection.step === 'Acquire') return { text: 'is picking a level', zoom: gridZoom(), live: true }
        const lookingAt = gameSession.mirroring ? selection.lookingAtCardId : undefined
        if (lookingAt && lookingAt !== selectedCardId) return { text: 'is looking at', detail: cardActions(lookingAt), imageUrl: cardUrl(lookingAt), live: true }
        if (selection.step) return { text: `is choosing ${selection.step}`, live: true }
        return undefined
    })

    // Once the turn has passed, the history closes with a final line until the next player starts.
    const finished = $derived(watching && actorId !== activeId && steps.length > 0)
    const entries = $derived(live ? [...steps, live] : finished ? [...steps, { text: 'finished their turn', live: true }] : steps)

    // Keep the newest entry in view as the history grows.
    let feedEl: HTMLDivElement | undefined = $state()
    $effect(() => {
        void entries.length
        void live
        tick().then(() => feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: 'smooth' }))
    })

    function capital(text: string) {
        return text.charAt(0).toUpperCase() + text.slice(1)
    }
</script>

{#if watching && entries.length}
    <div class="pointer-events-none fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-xl border-2 border-[#ffd166] bg-[#1b140c]/95 text-xs text-[#f1e6cf] shadow-2xl">
        <div class="border-b border-[#8a6d3b] px-2 py-1 text-sm"><strong class="capitalize">{name}</strong>'s turn</div>
        <div bind:this={feedEl} class="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-2">
            {#each entries as entry, index (index)}
                {@const newest = index === entries.length - 1}
                <div class="flex flex-col gap-1 {newest ? '' : 'opacity-70'}">
                    <div class={newest ? 'text-sm font-semibold text-[#ffd166]' : 'text-[#c9a961]'}>
                        {#if entry.live}<strong class="capitalize">{name}</strong> {entry.text}{:else}{index + 1}. {capital(entry.text)}{/if}
                    </div>
                    {#if entry.detail}<div class="text-[#f1e6cf]">{entry.detail}</div>{/if}
                    {#if entry.imageUrl}
                        <img src={entry.imageUrl} alt="" class="mx-auto {newest ? 'h-48' : 'h-24'} w-auto rounded-lg" draggable="false" />
                    {/if}
                    {#if entry.tokens?.length}
                        <div class="flex flex-wrap justify-center gap-2">
                            {#each entry.tokens as token, tokenIndex (tokenIndex)}
                                {@const url = weaponTokenImageUrl(token.kind as WeaponTokenKind)}
                                {#if url}
                                    <img src={url} alt={token.kind} class="{newest ? 'h-14 w-14' : 'h-9 w-9'} rounded-full {token.picked ? 'ring-4 ring-[#ffd166]' : 'opacity-40 grayscale'}" draggable="false" />
                                {/if}
                            {/each}
                        </div>
                    {/if}
                    {#if entry.zoom}
                        <svg viewBox="{entry.zoom.x} {entry.zoom.y} {entry.zoom.width} {entry.zoom.height}" class="block aspect-[4/3] {newest ? 'w-full' : 'w-2/3'} mx-auto rounded-lg border border-[#8a6d3b] bg-black" xmlns="http://www.w3.org/2000/svg">
                            <use href="#rv-board-svg" />
                        </svg>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}
