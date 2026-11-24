<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import turnAid from '$lib/images/aids/action-aid-back.png'
    import actionAid from '$lib/images/aids/action-aid-front.png'
    import huntAid from '$lib/images/aids/hunt-aid-front.png'
    import huntResultsAid from '$lib/images/aids/hunt-aid-back.png'

    // The printed player aids, for everyone. They print the current rules, so a game started under
    // older ones lists where it differs.
    const gameSession = getGameSession()

    const aids = [
        { id: 'turn', url: turnAid, alt: 'Player aid: your turn and gems' },
        { id: 'actions', url: actionAid, alt: 'Player aid: actions' },
        { id: 'hunting', url: huntAid, alt: 'Player aid: hunting' },
        { id: 'results', url: huntResultsAid, alt: 'Player aid: hunt results' }
    ]

    const differences = $derived.by(() => {
        const state = gameSession.gameState
        const lines: string[] = []
        if (!state.actionsInOrder) lines.push("A card's actions can be taken in any order.")
        if (!state.noGemPawnMove) lines.push('1 gem also moves your pawn to any card in your tableau.')
        if (!state.cardStacking) lines.push("Cards can't be stacked.")
        if (!state.feastCategories) lines.push("The Mana token isn't kept after a Mana sale.")
        if (!state.weaponFiveAppliesThree) lines.push('Weapon level 5 applies 2 tokens.')
        if (!state.huntHitsScoreAtFeasts) lines.push('Each hit scores 2 VP right away. There is no battle axe.')
        if (!state.bonusTokenCash) lines.push("The gold bonus gives $3, and other bonuses can't be taken as $3.")
        else if (!state.gainMineBonus) lines.push('The mine bonus only claims a level 2 gold mine.')
        if (!state.bonusInvestSlotCost) lines.push("Bonus Invest pays the card's full cost.")
        return lines
    })

    // The "?" on a hunt opens this tab at the hunting card.
    let panel: HTMLDivElement | undefined = $state()
    $effect(() => {
        const request = gameSession.aidRequest
        if (!request || !panel) return
        const card = panel.querySelector(`[data-aid="${request.aid}"]`)
        requestAnimationFrame(() => card?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
    })
</script>

<div bind:this={panel} class="h-full overflow-y-auto p-4 text-[#f1e6cf]">
    {#if differences.length}
        <div class="mb-3 max-w-[720px] rounded-lg border border-[#8a6d3b] bg-black/20 px-3 py-2 text-sm">
            <div class="font-semibold text-[#ffd166]">This game uses some older rules:</div>
            <ul class="ml-4 list-disc">
                {#each differences as line (line)}<li>{line}</li>{/each}
            </ul>
        </div>
    {/if}
    <div class="flex flex-wrap items-start gap-4">
        {#each aids as aid (aid.id)}
            <img
                data-aid={aid.id}
                src={aid.url}
                alt={aid.alt}
                width="674"
                height="1052"
                loading="lazy"
                draggable="false"
                class="block h-auto w-full max-w-[360px] rounded-lg shadow-lg"
            />
        {/each}
    </div>
</div>
