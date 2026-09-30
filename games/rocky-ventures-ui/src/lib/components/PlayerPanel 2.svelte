<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        CardKind,
        CompanyAbbreviations,
        HuntDrawRuleByWeaponLevel,
        OreCapacityByToolLevel,
        getCard,
        type HydratedRockyVenturesPlayerState
    } from '@tabletop/rocky-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.js'
    import gemIcon from '$lib/images/icons/gem.png'
    import Pawn from '$lib/components/Pawn.svelte'

    const gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: HydratedRockyVenturesPlayerState } =
        $props()

    const isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    const playerColor = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const playerTextColor = $derived(gameSession.colors.getPlayerTextColorValue(player.id))
    const oreCapacity = $derived(OreCapacityByToolLevel[playerState.toolLevel])
    const huntRule = $derived(HuntDrawRuleByWeaponLevel[playerState.weaponLevel])

    function cardLabel(cardId: string): string {
        const card = getCard(cardId)
        switch (card.kind) {
            case CardKind.Player:
                return card.numeral
            case CardKind.Development:
                return `${card.number}`
            case CardKind.EndOfEra:
                return `E${card.era}`
            case CardKind.GameOver:
                return 'GO'
        }
    }
</script>

<div
    class="overflow-hidden rounded-lg border text-sm text-left"
    style="background-color: #12162b; color: #e6e9f5; border-color: {isTurn ? '#4f7cf2' : '#2a3155'};"
>
    <div
        class="flex items-center justify-between border-b px-3 py-2"
        style="background-color: #1b2242; border-color: #2a3155;"
    >
        <div class="flex items-center gap-2 font-semibold">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {playerColor};"></span>
            <span class="rounded-md px-2 py-0.5" style="background-color: {playerColor}; color: {playerTextColor};">
                <PlayerName playerId={player.id} />
            </span>
        </div>
        <div class="flex items-center gap-1">
            <span class="font-mono text-sm font-semibold">{playerState.victoryPoints} VP</span>
            {#if isTurn}
                <span
                    class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style="border-color: #4f7cf2; color: #9db4f5;"
                >
                    Active
                </span>
            {/if}
        </div>
    </div>

    <div class="flex border-b" style="border-color: #2a3155;">
        <div class="flex-1 px-3 py-1.5">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Money</div>
            <div class="font-mono text-sm font-semibold">{`$${playerState.money}`}</div>
        </div>
        <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Gems</div>
            <div class="flex items-center gap-1 font-mono text-sm font-semibold">
                <img src={gemIcon} alt="" class="h-3.5 w-auto" />{playerState.gems}
            </div>
        </div>
        <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Mine Claims</div>
            <div class="flex items-center gap-1.5 font-mono text-sm font-semibold">
                {playerState.claimTokens}
                {#if playerState.redMinesUnlocked}
                    <span
                        class="inline-block h-3 w-3 rounded-full border-2"
                        style="border-color: #d3342f; background-color: #d3342f;"
                        title="Can claim red (level 4) mines"
                    ></span>
                {/if}
                {#if playerState.blueMinesUnlocked}
                    <span
                        class="inline-block h-3 w-3 rounded-full border-2"
                        style="border-color: #4141a8; background-color: #4141a8;"
                        title="Can claim blue (level 5) mines"
                    ></span>
                {/if}
            </div>
        </div>
    </div>

    <div class="flex border-b" style="border-color: #2a3155;">
        <div class="flex-1 px-3 py-1.5">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Weapon Level</div>
            <div class="font-mono text-sm font-semibold" title="Draw {huntRule.draw}, apply {huntRule.apply} on a hunt">
                {playerState.weaponLevel}
            </div>
        </div>
        <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Gold Tool Level</div>
            <div class="font-mono text-sm font-semibold" title="Tool level {playerState.toolLevel}: extracts up to {oreCapacity.gold} gold ore">
                {oreCapacity.gold}
            </div>
        </div>
        <div class="flex-1 border-l px-3 py-1.5" style="border-color: #2a3155;">
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Silver Tool Level</div>
            <div class="font-mono text-sm font-semibold" title="Tool level {playerState.toolLevel}: extracts up to {oreCapacity.silver} silver ore">
                {oreCapacity.silver}
            </div>
        </div>
    </div>

    <div class="flex items-center gap-x-1 border-b px-3 pb-1.5 pt-3" style="border-color: #2a3155;">
        {#each playerState.tableau as cardId, index (cardId)}
            <div
                class="relative flex h-7 w-6 items-center justify-center rounded border text-[11px] font-bold"
                style="background-color: #f3ead6; color: #111; border-color: #8a6d3b;"
                title={cardId}
            >
                {cardLabel(cardId)}
                {#if playerState.pawnIndex === index}
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2 drop-shadow">
                        <Pawn fill={playerColor} height={18} />
                    </div>
                {/if}
            </div>
        {/each}
        {#if playerState.tuckedCardIds.length > 0}
            <span class="ml-1 text-[11px]" style="color: #7f88ad;">+{playerState.tuckedCardIds.length} tucked</span>
        {/if}
        {#if playerState.pawnIndex === undefined}
            <span class="ml-auto flex items-center gap-1 text-[11px]" style="color: #7f88ad;">
                <Pawn fill={playerColor} height={18} /> off tableau
            </span>
        {/if}
    </div>

    {#if playerState.shares.length > 0 || playerState.agreements.length > 0}
        <div class="flex flex-wrap items-center gap-1 px-3 py-1.5 text-[11px]">
            {#each playerState.shares as share, i (i)}
                <span
                    class="rounded px-1.5 py-0.5 font-semibold"
                    style="background-color: {CompanyColors[share.companyId]}; color: {CompanyTextColors[share.companyId]};"
                    >{CompanyAbbreviations[share.companyId]} #{share.shareIndex + 1}</span
                >
            {/each}
            {#each playerState.agreements as agreement, i (i)}
                <span class="rounded border px-1.5 py-0.5" style="border-color: #2a3155;">{agreement.cityId} {agreement.letter}</span>
            {/each}
        </div>
    {/if}
    {#if gameSession.showDebug}
        <div class="px-3 pb-1 text-[10px]" style="color: #7f88ad;">id: {player.id}</div>
    {/if}
</div>
