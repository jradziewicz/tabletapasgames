<script lang="ts">
    import {
        ActionType,
        BoardNodesById,
        CardKind,
        CompanyNames,
        DragonHuntRegion,
        RegionIds,
        RegionNames,
        StatKind,
        getCard,
        planExtraction,
        type CompanyId,
        type WeaponTokenKind
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'
    import { DragonTileImageUrl, weaponTokenImageUrl } from '$lib/utils/dragonImages.js'
    import { scourgeImageUrl } from '$lib/utils/scourgeImages.js'
    import { mineTokenImageUrl } from '$lib/utils/tokenImages.js'
    import { companyLogoUrl } from '$lib/utils/companyLogos.js'
    import { GridRegion } from '$lib/utils/trackLayout.js'
    import { shareImageUrl } from '$lib/utils/shareImages.js'
    import { recentOtherPlayerAction } from '$lib/utils/recentAction.js'

    // Live play: a card someone buys or taxes, a hunt, or a mine claim pops up big for everyone
    // for a moment, then clears. A card or mine then glows where it landed (gameSession.spotlight).
    const gameSession = getGameSession()

    const PopUpMs = 2500
    const HighlightMs = 1500
    const Watched = [ActionType.Invest, ActionType.Tax, ActionType.ResolveHunt, ActionType.ClaimMine, ActionType.ExtractAndSell, ActionType.Acquire, ActionType.ChooseShare] as string[]

    let lastSeen = gameSession.actions.at(-1)?.id
    let timers: ReturnType<typeof setTimeout>[] = []

    $effect(() => {
        const action = gameSession.actions.at(-1)
        if (!action || action.id === lastSeen) return
        lastSeen = action.id
        if (!gameSession.livePlay || gameSession.isViewingHistory) return
        if (!Watched.includes(action.type)) return
        const playerId = action.playerId
        if (!playerId) return
        const nodeId = (action as { nodeId?: string }).nodeId
        // The action list can update a moment before the game state does, so read it just after.
        setTimeout(() => show(action.type as ActionType, playerId, nodeId), 50)
    })

    function regionLabel(region: string): string {
        if (region === DragonHuntRegion) return 'the Dragon'
        const id = RegionIds.find((candidate) => candidate === region)
        return id ? RegionNames[id] : region
    }

    function gain(amount: number, word: string, prefix = '') {
        return amount > 0 ? `+${prefix}${amount}${word ? ` ${word}` : ''}` : undefined
    }

    function show(type: ActionType, playerId: string, nodeId: string | undefined) {
        const state = gameSession.gameState
        let next: NonNullable<typeof gameSession.spotlight> | undefined
        if (type === ActionType.Invest || type === ActionType.Tax) {
            const cardId =
                type === ActionType.Invest
                    ? state.statEvents.findLast((event) => event.kind === StatKind.Purchase && event.playerId === playerId)?.cardId
                    : state.getPlayerState(playerId).tuckedCardIds.at(-1)
            if (cardId) next = { kind: 'card', playerId, cardId, phase: 'up' }
        } else if (type === ActionType.ClaimMine && nodeId) {
            const cost = state.statEvents.findLast((event) => event.kind === StatKind.MineClaim && event.playerId === playerId)?.amount ?? 0
            next = { kind: 'claim', playerId, nodeId, phase: 'up', claim: { mine: BoardNodesById[nodeId]?.name ?? nodeId, cost } }
        } else if (type === ActionType.ChooseShare) {
            const recent = recentOtherPlayerAction<{ companyId: CompanyId }>(gameSession, ActionType.ChooseShare, { includeMine: true })
            if (recent) {
                const company = recent.before.getCompany(recent.action.companyId)
                const index = company.nextShareIndex
                next = {
                    kind: 'share',
                    playerId,
                    phase: 'up',
                    share: {
                        company: CompanyNames[recent.action.companyId],
                        multiplier: company.multiplierForShare(index),
                        imageUrl: shareImageUrl(recent.action.companyId, index, company.sharesFlipped)
                    }
                }
            }
        } else if (type === ActionType.Acquire) {
            const recent = recentOtherPlayerAction<{ choice: 'weapon' | 'tool' }>(gameSession, ActionType.Acquire, { includeMine: true })
            if (recent) {
                const level = (state: typeof recent.before) => {
                    const player = state.getPlayerState(playerId)
                    return recent.action.choice === 'weapon' ? player.weaponLevel : player.toolLevel
                }
                next = { kind: 'level', playerId, phase: 'up', level: { choice: recent.action.choice, from: level(recent.before), to: level(recent.after) } }
            }
        } else if (type === ActionType.ExtractAndSell) {
            const recent = recentOtherPlayerAction<{ nodeId: string; creditCompanyId?: CompanyId }>(gameSession, ActionType.ExtractAndSell, { includeMine: true })
            const event = recent?.after.statEvents.slice(recent.before.statEvents.length).find((candidate) => candidate.kind === StatKind.MineExtract)
            if (recent && event) {
                const detail = Object.fromEntries((event.detail ?? '').split(';').map((pair) => pair.split('=') as [string, string]))
                const ore = event.source === 'gold' ? 'Gold' : event.source === 'silver' ? 'Silver' : 'ore'
                const token = recent.before.board.getMine(recent.action.nodeId).token
                const companyId = recent.action.creditCompanyId
                // Recreate the sale on the state before it, for the money breakdown.
                const plan = planExtraction(recent.before, playerId, recent.action as never)
                const lines =
                    typeof plan === 'string'
                        ? []
                        : [
                              { label: `Sale (${plan.oreCount} × $${plan.price})`, amount: plan.sale },
                              { label: 'Agreement bonus', amount: plan.agreementBonus },
                              { label: 'Transportation', amount: -plan.transport },
                              { label: 'Security', amount: -plan.security },
                              { label: 'Dragon', amount: -plan.dragon },
                              { label: 'Agreement discount', amount: plan.discount }
                          ].filter((line) => line.amount !== 0 || line.label.startsWith('Sale'))
                next = {
                    kind: 'delivery',
                    playerId,
                    nodeId: recent.action.nodeId,
                    phase: 'up',
                    delivery: {
                        amount: `${detail['ore'] ?? ''} ${ore}`.trim(),
                        mine: BoardNodesById[recent.action.nodeId]?.name ?? recent.action.nodeId,
                        city: BoardNodesById[detail['city'] ?? '']?.name,
                        railroad: companyId ? CompanyNames[companyId] : undefined,
                        companyId,
                        earned: event.amount ?? 0,
                        vp: recent.after.getPlayerState(playerId).victoryPoints - recent.before.getPlayerState(playerId).victoryPoints,
                        tokenUrl: token ? mineTokenImageUrl(token) : undefined,
                        lines
                    }
                }
            }
        } else if (type === ActionType.ResolveHunt) {
            const recent = recentOtherPlayerAction<{ tokenIndexes: number[]; hitTargets: string[] }>(gameSession, ActionType.ResolveHunt, { includeMine: true })
            const pending = recent?.before.pendingHunt
            if (recent && pending) {
                const before = recent.before.getPlayerState(playerId)
                const after = recent.after.getPlayerState(playerId)
                next = {
                    kind: 'hunt',
                    playerId,
                    phase: 'up',
                    hunt: {
                        region: pending.region,
                        tokens: pending.drawn.map((kind, index) => ({ kind, applied: recent.action.tokenIndexes.includes(index) })),
                        hitTargets: recent.action.hitTargets,
                        gains: [
                            gain(after.victoryPoints - before.victoryPoints, 'VP'),
                            gain(after.money - before.money, '', '$'),
                            gain(after.gems - before.gems, 'gem'),
                            gain(after.weaponLevel - before.weaponLevel, 'weapon level'),
                            gain((after.huntHits ?? 0) - (before.huntHits ?? 0), 'axe')
                        ].filter((text) => text !== undefined)
                    }
                }
            }
        }
        if (!next) return
        // One pop-up at a time: a move made while one is up (a share right after a card) waits its turn.
        queue.push(next)
        if (!popping) present()
    }

    let queue: NonNullable<typeof gameSession.spotlight>[] = []
    let popping = false

    function present() {
        const next = queue.shift()
        if (!next) {
            popping = false
            return
        }
        popping = true
        // Pop-ups are switched off (the watcher box tells the story); everyone just gets the glow
        // where the card, mine or share landed.
        const mine = true
        const shown: typeof next = mine ? { ...next, phase: 'landed' } : next
        gameSession.spotlight = shown
        timers.push(
            setTimeout(() => {
                if (gameSession.spotlight === shown) gameSession.spotlight = { ...shown, phase: 'landed' }
                present()
            }, mine ? 0 : PopUpMs),
            setTimeout(() => {
                if (gameSession.spotlight?.playerId === shown.playerId && gameSession.spotlight.kind === shown.kind && gameSession.spotlight.phase === 'landed') {
                    gameSession.spotlight = undefined
                }
            }, (mine ? 0 : PopUpMs) + HighlightMs)
        )
    }

    $effect(() => () => {
        for (const timer of timers) clearTimeout(timer)
    })

    const shown = $derived(gameSession.spotlight?.phase === 'up' ? gameSession.spotlight : undefined)
    const cardUrl = $derived.by(() => {
        const cardId = shown?.kind === 'card' ? shown.cardId : undefined
        if (!shown || !cardId) return undefined
        return getCard(cardId).kind === CardKind.Player
            ? playerCardImageUrl(cardId, gameSession.colors.getPlayerColor(shown.playerId))
            : cardImageUrl(cardId)
    })
    const mineUrl = $derived.by(() => {
        if (shown?.kind !== 'claim' || !shown.nodeId) return undefined
        const token = gameSession.gameState.board.getMine(shown.nodeId).token
        return token ? mineTokenImageUrl(token) : undefined
    })
</script>

{#if shown}
    <div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div class="spotlight-panel flex max-w-[90vw] flex-col items-center gap-3 rounded-xl border-2 border-[#ffd166] bg-[#1b140c]/95 p-5 text-[#f1e6cf] shadow-2xl">
            <div class="text-base">
                <strong class="capitalize">{gameSession.getPlayerName(shown.playerId)}</strong>
                {#if shown.kind === 'card'}took this card{:else if shown.kind === 'share'}took a <strong>{shown.share?.company}</strong> share{:else if shown.kind === 'level'}raised their <strong>{shown.level?.choice}</strong> to level <strong>{shown.level?.to}</strong>{:else if shown.kind === 'delivery'}delivered <strong>{shown.delivery?.amount}</strong> from <strong>{shown.delivery?.mine}</strong>{#if shown.delivery?.city}&nbsp;to <strong>{shown.delivery.city}</strong>{/if}{:else if shown.kind === 'claim'}claimed <strong>{shown.claim?.mine}</strong>{#if shown.claim?.cost}&nbsp;for ${shown.claim.cost}{/if}{:else}hunted <strong>{regionLabel(shown.hunt?.region ?? '')}</strong>{/if}
            </div>
            {#if shown.kind === 'card' && cardUrl}
                <img src={cardUrl} alt={shown.cardId} class="max-h-[55vh] w-auto rounded-xl" draggable="false" />
            {:else if shown.kind === 'share' && shown.share}
                {#if shown.share.imageUrl}<img src={shown.share.imageUrl} alt={shown.share.company} class="max-h-[45vh] w-auto rounded-xl" draggable="false" />{/if}
                <div class="text-3xl font-bold text-[#ffd166]">{shown.share.multiplier}x share</div>
            {:else if shown.kind === 'level' && shown.level}
                <svg viewBox="{GridRegion.x} {GridRegion.y} {GridRegion.width} {GridRegion.height}" class="block w-[min(80vw,640px)] rounded-lg border border-[#8a6d3b] bg-black" xmlns="http://www.w3.org/2000/svg">
                    <use href="#rv-board-svg" />
                </svg>
                <div class="text-3xl font-bold capitalize text-[#ffd166]">{shown.level.choice} {shown.level.from} → {shown.level.to}</div>
            {:else if shown.kind === 'delivery' && shown.delivery}
                {@const logo = shown.delivery.companyId ? companyLogoUrl(shown.delivery.companyId as CompanyId) : undefined}
                <div class="flex items-center justify-center gap-4">
                    {#if shown.delivery.tokenUrl}<img src={shown.delivery.tokenUrl} alt={shown.delivery.mine} class="h-32 w-32" draggable="false" />{/if}
                    <span class="text-5xl text-[#ffd166]">→</span>
                    <span class="rounded-lg border-2 border-[#ffd166] px-4 py-2 text-3xl font-bold">{shown.delivery.city ?? 'Sold'}</span>
                </div>
                {#if shown.delivery.railroad}
                    <div class="flex items-center gap-2 text-base">
                        {#if logo}<img src={logo} alt={shown.delivery.railroad} class="h-10 w-auto" draggable="false" />{/if}
                        <span>via <strong>{shown.delivery.railroad}</strong></span>
                    </div>
                {/if}
                {#if shown.delivery.lines.length}
                    <div class="grid grid-cols-[auto_auto] gap-x-6 text-base">
                        {#each shown.delivery.lines as line (line.label)}
                            <span>{line.label}</span>
                            <span class="text-right font-mono {line.amount < 0 ? 'text-[#ff8a7a]' : ''}">{line.amount < 0 ? `-$${-line.amount}` : `$${line.amount}`}</span>
                        {/each}
                    </div>
                {/if}
                <div class="text-3xl font-bold text-[#ffd166]">
                    {shown.delivery.earned < 0 ? `-$${-shown.delivery.earned}` : `+$${shown.delivery.earned}`}{#if shown.delivery.vp > 0}, +{shown.delivery.vp} VP{/if}
                </div>
            {:else if shown.kind === 'claim' && mineUrl}
                <img src={mineUrl} alt={shown.claim?.mine} class="h-40 w-40" draggable="false" />
            {:else if shown.kind === 'hunt' && shown.hunt}
                <div class="flex flex-wrap items-center justify-center gap-3">
                    {#each shown.hunt.tokens as token, index (index)}
                        {@const url = weaponTokenImageUrl(token.kind as WeaponTokenKind)}
                        {#if url}<img src={url} alt={token.kind} class="h-20 w-20 {token.applied ? '' : 'opacity-35 grayscale'}" draggable="false" />{/if}
                    {/each}
                    {#each shown.hunt.hitTargets as target, index (index)}
                        {@const url = target === DragonHuntRegion ? DragonTileImageUrl : scourgeImageUrl(target)}
                        {#if url}<img src={url} alt={target} class="h-28 w-auto rounded" draggable="false" />{/if}
                    {/each}
                </div>
                {#if shown.hunt.gains.length}<div class="text-lg font-semibold text-[#ffd166]">{shown.hunt.gains.join(', ')}</div>{/if}
            {/if}
        </div>
    </div>
{/if}

<style>
    .spotlight-panel {
        animation: spotlight 2500ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
    }
    @keyframes spotlight {
        0% {
            transform: scale(0.4);
            opacity: 0;
        }
        18% {
            transform: scale(1);
            opacity: 1;
        }
        82% {
            transform: scale(1);
            opacity: 1;
        }
        100% {
            transform: scale(0.3) translateY(30vh);
            opacity: 0;
        }
    }
</style>
