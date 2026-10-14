<script lang="ts">
    import { type Player } from '@tabletop/common'
    import {
        CardKind,
        HuntDrawRuleByWeaponLevel,
        OreCapacityByToolLevel,
        getCard,
        type HydratedRockyVenturesPlayerState
    } from '@tabletop/rocky-ventures'
    import { agreementTooltip } from '$lib/utils/agreementImages.js'
    import { BotProfileNames } from '$lib/bots/rockyBots.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CompanyColors, CompanyTextColors } from '$lib/utils/companyDisplay.svelte.js'
    import gemIcon from '$lib/images/icons/gem.png'
    import Pawn from '$lib/components/Pawn.svelte'
    import { cardActionsTooltip } from '$lib/utils/cardActionText.js'
    import { cardImageUrl } from '$lib/utils/cardImages.js'
    import { playerCardImageUrl } from '$lib/utils/playerCardImages.js'

    const gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: HydratedRockyVenturesPlayerState } =
        $props()

    const botProfile = $derived(gameSession.botSeats[player.id])
    const isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    const playerColor = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const playerTextColor = $derived(gameSession.colors.getPlayerTextColorValue(player.id))
    const oreCapacity = $derived(OreCapacityByToolLevel[playerState.toolLevel])
    const huntRule = $derived(HuntDrawRuleByWeaponLevel[playerState.weaponLevel])

    function tableauImageUrl(cardId: string): string | undefined {
        return getCard(cardId).kind === CardKind.Player
            ? playerCardImageUrl(cardId, playerState.color)
            : cardImageUrl(cardId)
    }

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
    <!-- Header painted in the player's colour, like Stellar Ventures' player boxes. -->
    <div
        class="flex items-center justify-between border-b px-3 py-2"
        style="background-color: {playerColor}; color: {playerTextColor}; border-color: #2a3155;"
    >
        <div class="flex items-center gap-2 font-semibold">
            <span class="capitalize">{player.id === gameSession.myPlayer?.id ? 'You' : gameSession.getPlayerName(player.id)}</span>
        </div>
        <div class="flex items-center gap-1">
            <span class="font-mono text-sm font-semibold">{playerState.victoryPoints} VP</span>
            {#if isTurn}
                <span class="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Active
                </span>
            {/if}
            {#if botProfile}
                <span class="rounded-full border border-current bg-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {BotProfileNames[botProfile]}
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
            <div class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Claim Tokens</div>
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

    <!-- What this player's levels actually let them do, rather than the bare level numbers. -->
    <div class="grid grid-cols-2 gap-px border-b" style="background-color: #2a3155; border-color: #2a3155;">
        <div class="px-3 py-2" style="background-color: #12162b;" title="Weapon level {playerState.weaponLevel}">
            <div class="flex items-baseline justify-between">
                <span class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Hunt</span>
                <span class="text-[10px]" style="color: #7f88ad;">Weapon {playerState.weaponLevel}</span>
            </div>
            <div class="mt-0.5 flex items-baseline gap-1.5 font-semibold">
                <span>Draw <span class="font-mono">{huntRule.draw}</span></span>
                <span style="color: #4a5175;">·</span>
                <span>Keep <span class="font-mono">{huntRule.apply}</span></span>
            </div>
        </div>
        <div class="px-3 py-2" style="background-color: #12162b;" title="Tool level {playerState.toolLevel}">
            <div class="flex items-baseline justify-between">
                <span class="text-[10px] uppercase tracking-widest" style="color: #7f88ad;">Extract</span>
                <span class="text-[10px]" style="color: #7f88ad;">Tool {playerState.toolLevel}</span>
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 font-semibold">
                <span class="flex items-center gap-1 whitespace-nowrap" title="Up to {oreCapacity.gold} gold ore per extract">
                    <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: radial-gradient(circle at 35% 35%, #ffe08a, #c99a2e);"></span>
                    <span class="font-mono">{oreCapacity.gold}</span> Gold
                </span>
                <span class="flex items-center gap-1 whitespace-nowrap" title="Up to {oreCapacity.silver} silver ore per extract">
                    <span class="inline-block h-2.5 w-2.5 rounded-full" style="background: radial-gradient(circle at 35% 35%, #ffffff, #9aa3b2);"></span>
                    <span class="font-mono">{oreCapacity.silver}</span> Silver
                </span>
            </div>
        </div>
    </div>

    <div class="flex items-center gap-x-1 border-b px-3 pb-1.5 pt-6" style="border-color: #2a3155;">
        {#each playerState.tableau as cardId, index (cardId)}
            {@const imageUrl = tableauImageUrl(cardId)}
            <button
                type="button"
                class="relative flex h-7 w-6 items-center justify-center rounded border text-[11px] font-bold"
                style="background-color: #f3ead6; color: #111; border-color: #8a6d3b;"
                title={cardActionsTooltip(cardId)}
                onclick={() => gameSession.zoomCard(cardId, imageUrl)}
                onpointerenter={(event) => gameSession.previewCard(event, cardId, imageUrl)}
                onpointerleave={() => gameSession.clearCardPreview()}
            >
                {cardLabel(cardId)}
                {#if playerState.pawnIndex === index}
                    <div class="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2">
                        <Pawn fill={playerColor} height={36} />
                    </div>
                {/if}
            </button>
        {/each}
        {#if playerState.tuckedCardIds.length > 0}
            <span class="ml-1 text-[11px]" style="color: #7f88ad;">+{playerState.tuckedCardIds.length} tucked</span>
        {/if}
        {#if playerState.pawnIndex === undefined}
            <span class="ml-auto flex items-center gap-1 text-[11px]" style="color: #7f88ad;">
                <Pawn fill={playerColor} height={28} />
            </span>
        {/if}
    </div>

    {#if playerState.shares.length > 0 || playerState.agreements.length > 0}
        <div class="flex flex-wrap items-center gap-1.5 px-3 py-1.5 text-[11px]">
            {#if playerState.shares.length > 0}
                <span class="text-[10px] font-semibold uppercase tracking-wide" style="color: #7f88ad;">Shares</span>
            {/if}
            {#each playerState.shares as share, i (i)}
                {@const company = gameSession.gameState.getCompany(share.companyId)}
                <span
                    class="rounded px-2 py-0.5 text-sm font-bold"
                    style="background-color: {CompanyColors[share.companyId]}; color: {CompanyTextColors[share.companyId]};"
                    title="{company.multiplierForShare(share.shareIndex) * company.value > 0 ? `Worth $${company.multiplierForShare(share.shareIndex) * company.value}` : ''}"
                    >×{company.multiplierForShare(share.shareIndex)}</span
                >
            {/each}
            {#if playerState.agreements.length > 0}
                <span class="ml-1 text-[10px] font-semibold uppercase tracking-wide" style="color: #7f88ad;">Agreements</span>
            {/if}
            {#each playerState.agreements as agreement, i (i)}
                <span class="rounded border px-1.5 py-0.5" style="border-color: #2a3155;" title={agreementTooltip(agreement.cityId, agreement.letter)}>{agreement.cityId} {agreement.letter}</span>
            {/each}
        </div>
    {/if}
    {#if gameSession.showDebug}
        <div class="px-3 pb-1 text-[10px]" style="color: #7f88ad;">id: {player.id}</div>
    {/if}
</div>
