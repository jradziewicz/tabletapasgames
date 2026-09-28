<script lang="ts">
    import {
        AgreementTrackMaxPlanets,
        alienPlanetOutpostCount,
        HexType
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CorporationShareCertificateIcons,
        CorporationAgreementTokenIcons
    } from '$lib/utils/corporationDisplay.js'
    import {
        AlienAgreementTileRevealedIcons,
        AlienAgreementTileHiddenIcon,
        signedAgreementTileIcon,
        AGREEMENT_SHARE_HEIGHT_PCT,
        AGREEMENT_SHARE_TOP_PCT,
        AGREEMENT_TOKEN_HEIGHT_PCT,
        AGREEMENT_TOKEN_TOP_PCT,
        AGREEMENT_TRACK_COLUMN_LEFT_PCT,
        AGREEMENT_TRACK_PLANET_COUNTS,
        AGREEMENT_TRACK_COLUMN_WIDTH_PCT
    } from '$lib/utils/agreementTileDisplay.js'
    import { CorporatePowerDisplayNames } from '$lib/utils/corporatePowerDisplay.js'
    import {
        powerCardImageForSide,
        powerHasTwoSides,
        POWER_CARD_ASPECT,
        type PowerCardSide
    } from '$lib/utils/corporatePowerImages.js'
    import agreementTrackArt from '$lib/images/trackers/theAgreement.png'
    import alienPlanetIcon from '$lib/images/agreement/alienPlanetIcon.png'

    const gameSession = getGameSession()

    // The same shared draft pool DraftPowerPanel.svelte draws from - a Corporation that Signs
    // The Agreement discards Alien Explorers and drafts one of these as its replacement (see
    // signTheAgreement.ts / stateHandlers/offerSignTheAgreement.ts), from the very same pool the
    // Initial Auction's own winners already drafted down. Shown here purely for reference (no
    // draft action lives on this tab), so a President can see what's actually available before
    // deciding whether to sign at all.
    const availableCorporatePowerIds = $derived(gameSession.gameState.availableCorporatePowerIds)

    // Which face of each reference card is currently showing - same flip-per-card convention as
    // DraftPowerPanel.svelte, just without the click-to-draft behavior that lives there instead.
    let powerSideById = $state<Record<string, PowerCardSide>>({})
    function powerSideFor(powerId: string): PowerCardSide {
        return powerSideById[powerId] ?? 'back'
    }
    function flipPower(powerId: string) {
        if (!powerHasTwoSides(powerId)) {
            return
        }
        powerSideById = { ...powerSideById, [powerId]: powerSideFor(powerId) === 'front' ? 'back' : 'front' }
    }

    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    const alienPlanetHexes = $derived(
        Object.values(gameSession.gameState.board.hexes).filter((hex) => hex.type === HexType.AlienPlanet)
    )

    // Once a Corporation Signs The Agreement, that hex's physical tile is taken off the board
    // entirely and returned to the box (see signTheAgreement.ts) - so the "Alien Planet Tiles"
    // grid below, which is meant to show what's still physically present on the board, should
    // stop listing it. signedAgreementTileIcon() above still looks tiles up by hex regardless of
    // removal, since that per-Corporation box is about what was revealed, not what's still there.
    const remainingAlienPlanetTileHexes = $derived(
        alienPlanetHexes.filter((hex) => !hex.alienAgreementTileRemoved)
    )

    const planetCounts = AGREEMENT_TRACK_PLANET_COUNTS

    // Which active Corporations have signed The Agreement at each planet-count threshold, so
    // their own Outpost icon can be dropped into that column below the art - this is the actual
    // "tracking" the co-designer asked for, since the art itself has no moving parts.
    const signedCorporationsByPlanetCount = $derived.by(() => {
        const buckets = new Map<number, typeof activeCorporations>()
        for (const count of planetCounts) {
            buckets.set(count, [])
        }
        for (const corporation of activeCorporations) {
            if (!corporation.agreement) continue
            const bucket = Math.min(corporation.agreement.planetCountAtSigning, AgreementTrackMaxPlanets)
            buckets.get(bucket)?.push(corporation)
        }
        return buckets
    })

    // Every Corporation that's signed, regardless of threshold - each one moved exactly 1 Share
    // to Alien Shareholdings when it signed (signTheAgreement.ts step 2), so this is the full set
    // of Share Certificates that belong in that section of the art.
    const signedCorporations = $derived(activeCorporations.filter((corporation) => corporation.agreement))
</script>

<div class="h-full overflow-y-auto p-4 text-[#e6e9f5]">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        The Agreement &amp; Alien Shareholdings
    </h2>

    <h3 class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Corporate Powers Available to Draft
    </h3>
    <!-- Same fixed w-[10.5rem] card size as everywhere else a Power is drafted (DraftPowerPanel,
         InitialAuctionPanel), so it reads at a consistent size here too even though this is just
         a reference list, not the actual draft step. -->
    <div class="mb-4 flex flex-wrap gap-3">
        {#each availableCorporatePowerIds as powerId (powerId)}
            <div class="group relative w-[10.5rem] shrink-0 overflow-hidden rounded-md">
                <img
                    src={powerCardImageForSide(powerId, powerSideFor(powerId)) ?? ''}
                    alt={CorporatePowerDisplayNames[powerId] ?? powerId}
                    class="block w-full"
                    style="aspect-ratio: {POWER_CARD_ASPECT};"
                />
                {#if powerHasTwoSides(powerId)}
                    <button
                        type="button"
                        onclick={() => flipPower(powerId)}
                        class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-0 bg-black/60 text-xs leading-none text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Flip card"
                        title="Flip card"
                    >⟲</button>
                {/if}
            </div>
        {/each}
        {#if availableCorporatePowerIds.length === 0}
            <div class="text-xs text-[#7f88ad]">No Corporate Powers currently available.</div>
        {/if}
    </div>

    <h3 class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Agreement Track
    </h3>
    <!-- Tracks which Corporations have actually signed - the art itself is static, so this is
         where "signing The Agreement" becomes visible: each signed Corporation's own Outpost
         icon (its Agreement Token) lands directly on the track line in the column it signed at,
         and a Share Certificate for each lands inside the Alien Shareholdings box - right on the
         art itself (same placement OfferSignTheAgreementPanel.svelte uses for its own one
         Corporation's reveal), not in a separate row below it. -->
    <div class="relative mb-4 overflow-hidden rounded-lg">
        <img src={agreementTrackArt} alt="The Agreement" class="block w-full" />
        {#each planetCounts as count, index (count)}
            {@const signed = signedCorporationsByPlanetCount.get(count) ?? []}
            {#if signed.length > 0}
                <div
                    class="absolute flex flex-wrap items-center justify-center gap-1"
                    style="left: {AGREEMENT_TRACK_COLUMN_LEFT_PCT[
                        index
                    ]}%; width: {AGREEMENT_TRACK_COLUMN_WIDTH_PCT[
                        index
                    ]}%; top: {AGREEMENT_TOKEN_TOP_PCT}%; height: {AGREEMENT_TOKEN_HEIGHT_PCT}%;"
                >
                    {#each signed as corporation (corporation.id)}
                        <img
                            src={CorporationAgreementTokenIcons[corporation.id]}
                            alt="{CorporationDisplayNames[corporation.id]} Agreement Token"
                            title="{CorporationDisplayNames[corporation.id]} - Signed The Agreement"
                            class="h-full w-auto object-contain drop-shadow"
                        />
                    {/each}
                </div>
            {/if}
        {/each}
        {#if signedCorporations.length > 0}
            <div
                class="absolute flex flex-wrap items-center justify-center gap-1"
                style="left: {AGREEMENT_TRACK_COLUMN_LEFT_PCT[4]}%; width: {AGREEMENT_TRACK_COLUMN_WIDTH_PCT[4]}%; top: {AGREEMENT_SHARE_TOP_PCT}%; height: {AGREEMENT_SHARE_HEIGHT_PCT}%;"
            >
                {#each signedCorporations as corporation (corporation.id)}
                    <img
                        src={CorporationShareCertificateIcons[corporation.id]}
                        alt="{CorporationDisplayNames[corporation.id]} Share Certificate - Alien Shareholdings"
                        title="{CorporationDisplayNames[corporation.id]} - Alien Shareholdings"
                        class="h-full w-auto rounded-sm object-contain shadow-lg"
                    />
                {/each}
            </div>
        {/if}
    </div>

    <h3 class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Corporations
    </h3>
    <div class="mb-4 space-y-2">
        {#each activeCorporations as corporation (corporation.id)}
            {@const planetCount = alienPlanetOutpostCount(gameSession.gameState.board, corporation.id)}
            {@const logoAspect = CorporationLogoAspect[corporation.id] ?? 1}
            <div class="rounded-lg border border-[#2a3155] bg-[#12162b] px-3 py-2">
                <div class="flex items-center gap-3">
                    <img
                        src={CorporationLogoIcons[corporation.id]}
                        alt=""
                        class="h-8 shrink-0 drop-shadow"
                        style="width: {32 * logoAspect}px;"
                    />
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-semibold text-[#e6e9f5]">
                            {CorporationDisplayNames[corporation.id]}
                        </div>
                        <!-- Everything else about this Corporation's Agreement status lives in
                             this one wrapping row now - no separate divider/box underneath -
                             Alien Planet Outposts shown as one small planet icon apiece (rather
                             than a count) and the signing status (bonus text once signed, or the
                             co-designer's own colored handshake token before that) right beside
                             it. -->
                        <div class="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#c3c9e6]">
                            {#if planetCount > 0}
                                <div class="flex flex-wrap items-center gap-1">
                                    {#each { length: planetCount } as _, index (index)}
                                        <img
                                            src={alienPlanetIcon}
                                            alt="Alien Planet Outpost"
                                            title="Alien Planet Outpost"
                                            class="h-4 w-4 shrink-0 rounded-full object-cover drop-shadow"
                                        />
                                    {/each}
                                </div>
                            {/if}
                            {#if corporation.agreement}
                                {@const tileIcon = signedAgreementTileIcon(alienPlanetHexes, corporation.id)}
                                {#if tileIcon}
                                    <!-- The actual Alien Agreement Tile this Corporation flipped
                                         to sign - takes over the same spot the handshake token
                                         occupied before signing. -->
                                    <img
                                        src={tileIcon}
                                        alt="Alien Agreement Tile - signed The Agreement"
                                        title="Alien Agreement Tile - signed The Agreement"
                                        class="h-8 w-8 shrink-0 rounded-md bg-black/20 object-contain p-1 drop-shadow"
                                    />
                                {/if}
                            {:else if CorporationAgreementTokenIcons[corporation.id]}
                                <!-- The co-designer's own colored handshake token stands in for
                                     "has not signed yet" - it simply disappears (the branch above
                                     takes over) the moment this Corporation actually signs.
                                     Amethyst Agency has no token at all here (see
                                     CorporationAgreementTokenIcons) since the rules never let it
                                     sign in the first place, so it shows neither branch. -->
                                <img
                                    src={CorporationAgreementTokenIcons[corporation.id]}
                                    alt="Has not signed The Agreement"
                                    title="Has not signed The Agreement"
                                    class="h-6 w-auto drop-shadow"
                                />
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </div>

    <h3 class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
        Alien Planet Tiles
    </h3>
    <div class="flex flex-wrap gap-2">
        {#each remainingAlienPlanetTileHexes as hex (hex.id)}
            {@const revealed = hex.alienAgreementTileHidden === false}
            {@const chevrons = hex.alienAgreementTileChevrons}
            <div class="flex items-center justify-center rounded-md bg-black/20 p-1.5">
                <img
                    src={revealed && chevrons !== undefined
                        ? (AlienAgreementTileRevealedIcons[chevrons] ?? AlienAgreementTileHiddenIcon)
                        : AlienAgreementTileHiddenIcon}
                    alt={revealed
                        ? `Alien Agreement Tile - ${chevrons} chevron${chevrons === 1 ? '' : 's'}`
                        : 'Alien Agreement Tile - hidden'}
                    class="h-14 w-14 shrink-0 object-contain drop-shadow"
                />
            </div>
        {/each}
        {#if remainingAlienPlanetTileHexes.length === 0}
            <div class="text-xs text-[#7f88ad]">No Alien Planet tiles remain on the board.</div>
        {/if}
    </div>
</div>
