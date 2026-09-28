<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CorporationId, HydratedChooseAmethystHomePlanet } from '@tabletop/stellar-ventures'
    import { CorporationDisplayNames, CorporationLogoIcons, CorporationLogoAspect } from '$lib/utils/corporationDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    // The final step of Form Amethyst Agency (stateHandlers/formAmethystAgency.ts), once its
    // Formation Auction has resolved: the winning President chooses one of Amethyst Agency's 3
    // candidate Home Planets by clicking it on the board (Board.svelte's own
    // ChooseAmethystHomePlanet board action mode highlights them) - this panel just shows who's
    // deciding, the actual click happens on the board itself, same split as Expand Network's own
    // panel/Board.svelte pairing.
    const corporation = $derived(gameSession.gameState.getCorporation(CorporationId.AmethystAgency))
    const presidentId = $derived(corporation.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)
    const remainingHexCount = $derived(
        HydratedChooseAmethystHomePlanet.availableHomePlanetHexIds(gameSession.gameState).length
    )
</script>

<div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
    <div class="text-xs font-semibold uppercase tracking-wide text-[#7f88ad]">
        Form Amethyst Agency - Choose Home Planet
    </div>
    <div class="flex items-center gap-3">
        <img
            src={CorporationLogoIcons[CorporationId.AmethystAgency]}
            alt="{CorporationDisplayNames[CorporationId.AmethystAgency]} logo"
            class="h-12 shrink-0 drop-shadow"
            style="width: {48 * (CorporationLogoAspect[CorporationId.AmethystAgency] ?? 1)}px;"
        />
        <div class="text-sm">
            {#if presidentId}
                <PlayerName playerId={presidentId} />
            {/if}
            won the Formation Auction and is President of
            <span class="font-semibold">{CorporationDisplayNames[CorporationId.AmethystAgency]}</span>.
        </div>
    </div>

    {#if isMe}
        <div class="text-xs text-[#7f88ad]">
            Choose one of the {remainingHexCount} highlighted Home Planet hexes on the board to place
            a free Outpost and fully activate {CorporationDisplayNames[CorporationId.AmethystAgency]}.
        </div>
    {:else if presidentId}
        <div class="text-xs text-[#7f88ad]">
            Waiting on <PlayerName playerId={presidentId} /> to choose a Home Planet...
        </div>
    {/if}

    {#if gameSession.lastActionError}
        <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
    {/if}
</div>
