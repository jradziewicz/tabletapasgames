<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionType,
        AgreementTrackMaxPlanets,
        alienPlanetOutpostCount,
        CorporatePowerId
    } from '@tabletop/stellar-ventures'
    import {
        CorporationDisplayNames,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT,
        CorporationAgreementTokenIcons
    } from '$lib/utils/corporationDisplay.js'
    import {
        activePowerCardImageForSide,
        alienExplorersSignTheAgreementImage,
        POWER_CARD_ASPECT
    } from '$lib/utils/corporatePowerImages.js'
    import {
        AGREEMENT_SHARE_HEIGHT_PCT,
        AGREEMENT_SHARE_TOP_PCT,
        AGREEMENT_TOKEN_HEIGHT_PCT,
        AGREEMENT_TOKEN_TOP_PCT,
        AGREEMENT_TRACK_COLUMN_LEFT_PCT,
        AGREEMENT_TRACK_COLUMN_WIDTH_PCT,
        AGREEMENT_TRACK_PLANET_COUNTS,
        AlienAgreementTileHiddenIcon,
        AlienAgreementTileRevealedIcons
    } from '$lib/utils/agreementTileDisplay.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import agreementTrackArt from '$lib/images/trackers/theAgreement.png'
    import alienPlanetIcon from '$lib/images/agreement/alienPlanetIcon.png'
    import alienMarker from '$lib/images/markers/alien.png'
    import agreementBonusTagMask2p from '$lib/images/trackers/agreementBonusTagMask2p.png'
    import agreementBonusTagMask3p from '$lib/images/trackers/agreementBonusTagMask3p.png'
    import agreementBonusTagMask4p from '$lib/images/trackers/agreementBonusTagMask4p.png'
    import agreementBonusTagMask5p from '$lib/images/trackers/agreementBonusTagMask5p.png'

    // Sign The Agreement (rulebook page 22) - offered immediately after a build lands on an
    // Alien Planet with a still-hidden tile, once the Corporation meets every requirement (see
    // operations/agreement.ts). The choice always belongs to the Corporation's President, who
    // may not be whoever's turn it otherwise is (state.signTheAgreementCorporationId /
    // signTheAgreementHexId - see stateHandlers/offerSignTheAgreement.ts) - so this panel, like
    // DraftPowerPanel, is visible to everyone but only actionable for that President. The hex
    // itself is never a player choice here (gameSession.signTheAgreement() reads
    // signTheAgreementHexId straight off game state), so the whole decision is just these two
    // buttons.
    //
    // Signing is walked through in three steps (see session.svelte.ts): Sign flips the Alien
    // Explorers Power to its "Sign The Agreement" face, Issue Share moves a Share into Alien
    // Shareholdings and places the Agreement Token, and Flip the Alien Planet Tile reveals the
    // chevrons and the Alien Corporation's Mining Capacity gain. The first two are local previews
    // (gameSession.signTheAgreementStaged) with a Back button; only the tile flip submits the real
    // action. After that, gameSession.signTheAgreementReveal pins this panel on screen until the
    // President clicks Continue, even though machineState has already moved on to DraftPower.
    // Falling back to reveal.corporationId/reveal.hexId below whenever the live signTheAgreement*
    // fields have cleared keeps every derived value resolving through that final step.
    const gameSession = getGameSession()

    // "You are ..." for the viewer, "<name> is ..." for anyone else (PlayerName renders "You").
    function isOrAre(playerId: string | undefined) {
        return playerId !== undefined && playerId === gameSession.myPlayer?.id ? 'are' : 'is'
    }

    const reveal = $derived(gameSession.signTheAgreementReveal)
    const staged = $derived(gameSession.signTheAgreementStaged)
    // Where the walkthrough is, whether previewed locally or already submitted.
    const powerFlipped = $derived(!!reveal || staged !== undefined)
    const shareIssued = $derived(!!reveal || staged === 'shares')
    const tileFlipped = $derived(!!reveal)
    const corporationId = $derived(
        reveal?.corporationId ?? gameSession.gameState.signTheAgreementCorporationId
    )
    const hexId = $derived(reveal?.hexId ?? gameSession.gameState.signTheAgreementHexId)
    const hex = $derived(hexId ? gameSession.gameState.board.hexes[hexId] : undefined)
    const corporation = $derived(
        corporationId ? gameSession.gameState.getCorporation(corporationId) : undefined
    )
    const presidentId = $derived(corporation?.getPresidentPlayerId())
    const isMe = $derived(!!gameSession.myPlayer && gameSession.myPlayer.id === presidentId)

    const canSign = $derived(gameSession.validActionTypes.includes(ActionType.SignTheAgreement))
    const canDecline = $derived(
        gameSession.validActionTypes.includes(ActionType.DeclineSignTheAgreement)
    )

    // A preview of what signing right now would actually pay, based on the Corporation's current
    // Alien Planet Outpost count - the same figure Sign The Agreement itself records
    // (corporation.agreement.planetCountAtSigning) - so the President can weigh signing now
    // against declining to try to reach a higher threshold later.
    const planetCount = $derived(
        corporationId ? alienPlanetOutpostCount(gameSession.gameState.board, corporationId) : 0
    )
    // The Corporation's own held Alien Explorers Power, shown here so the President can see
    // exactly what they're giving up by signing (this Power is discarded as part of Sign The
    // Agreement - see actions/signTheAgreement.ts). Its normal face throughout the offer; once
    // reveal is pinned, the dedicated per-Corporation "Sign The Agreement" front face instead - a
    // static lookup keyed only on corporationId, so it still resolves correctly even though the
    // Power itself has already been discarded from corporation.powers by that same atomic apply().
    const alienExplorersImage = $derived(
        corporationId
            ? powerFlipped
                ? alienExplorersSignTheAgreementImage(corporationId)
                : activePowerCardImageForSide(corporationId, CorporatePowerId.AlienExplorers, 'back')
            : undefined
    )

    // Both the Power tile above and this Share stack are sized off the same height, so they
    // read as two pieces of equal visual weight sitting side by side.
    const PIECE_HEIGHT_PX = 107
    // 66% smaller than the other pieces in this row - it's just a status marker, not one of the
    // decision-relevant pieces those are sized to draw attention to.
    const HANDSHAKE_TOKEN_HEIGHT_PX = Math.round(PIECE_HEIGHT_PX * 0.34)

    // Shares still sitting on the Charter, unissued (Corporation.availableShareCount - same
    // field CorporationCharter.svelte's own Share stack uses) - shown as a small fanned stack of
    // the real Share Certificate art next to the Alien Planet count. Once submitted, the live
    // figure already reflects the issued Share; during the local Issue Share preview it's shown
    // one lower so that moment reads as the Share actually leaving.
    const availableShareCount = $derived(corporation?.availableShareCount ?? 0)
    const displayedShareCount = $derived(
        !reveal && staged === 'shares' ? Math.max(availableShareCount - 1, 0) : availableShareCount
    )
    const SHARE_STACK_FAN_OFFSET_PX = 14

    // The Alien Planet's own tile - face down until the President flips it (the step that
    // actually submits the signing), then its real chevron count.
    const chevrons = $derived(hex?.alienAgreementTileChevrons)
    const alienTileImage = $derived(
        tileFlipped && chevrons !== undefined
            ? (AlienAgreementTileRevealedIcons[chevrons] ?? AlienAgreementTileHiddenIcon)
            : AlienAgreementTileHiddenIcon
    )

    // Flipping the tile also reveals the Alien Corporation's Mining Capacity gain from it (rule-
    // book: "+3 Mining Capacity per chevron" - applied by signTheAgreement.ts step 1).
    const alienMiningCapacityGain = $derived(tileFlipped && chevrons !== undefined ? chevrons * 3 : 0)

    // Where the Agreement Token lands on the Agreement Track art once Issue Share is clicked -
    // same bucket-by-planet-count lookup AgreementPanel.svelte uses for its own copy of this
    // track. Before submitting (the local Issue Share preview) that's the current Alien Planet
    // count, which is exactly what signing will record; afterwards, the recorded
    // corporation.agreement.planetCountAtSigning.
    const agreementTrackColumnIndex = $derived.by(() => {
        const planetCountAtSigning = corporation?.agreement?.planetCountAtSigning ?? planetCount
        if (!planetCountAtSigning) {
            return undefined
        }
        const bucket = Math.min(planetCountAtSigning, AgreementTrackMaxPlanets)
        const index = AGREEMENT_TRACK_PLANET_COUNTS.indexOf(bucket)
        return index === -1 ? undefined : index
    })

    // Live preview (pre-signing) of that same column, but keyed off the Corporation's CURRENT
    // Alien Planet Outpost count (planetCount above) rather than the recorded
    // planetCountAtSigning (which doesn't exist until after actually signing). Drives the
    // pulsing highlight over that column's own printed "instant" Bonus Dividend figure (the
    // "!$X > bag" icon row at the top of each column - bonusDividendPerShare, paid the moment
    // Sign The Agreement resolves, as opposed to the Agreement Bonus figure below it which only
    // pays out later at Liquidation) - shown only before signing (!reveal), so the President can
    // see exactly what they'd receive right now without having to already know the printed
    // track by heart.
    const livePlanetCountColumnIndex = $derived.by(() => {
        const bucket = Math.min(planetCount, AgreementTrackMaxPlanets)
        const index = AGREEMENT_TRACK_PLANET_COUNTS.indexOf(bucket)
        return index === -1 ? undefined : index
    })

    // Per-column placement of the pulsing "instant Bonus Dividend" highlight (see
    // livePlanetCountColumnIndex above) - a small alpha-masked cutout of that column's own
    // printed "$X" scalloped plaque (cropped straight off theAgreement.png, with the plaque's
    // real silhouette as its alpha channel - background and any gaps in the scallop are fully
    // transparent, the plaque + digit are opaque and pixel-identical to the art underneath) so
    // filter: drop-shadow(...) glows around the plaque's actual wavy border rather than a plain
    // box - same "drop-shadow on a real cutout" convention as DividendChartPanel's own
    // .backroom-deal-target-pulse/.deep-space-smuggling-target-pulse. left/top/width/height are
    // each mask's exact crop box (with a few px of padding) as a percentage of the full
    // 2965x592 track art, measured directly off the image; a fixed 10px padding on all sides is
    // baked into every crop so the scallop bumps and glow both have breathing room.
    const AGREEMENT_BONUS_TAG_HIGHLIGHT = [
        { src: agreementBonusTagMask2p, left: 5.329, top: 23.818, width: 4.486, height: 16.385 },
        { src: agreementBonusTagMask3p, left: 21.417, top: 23.818, width: 4.486, height: 16.385 },
        { src: agreementBonusTagMask4p, left: 37.707, top: 23.818, width: 4.486, height: 16.385 },
        { src: agreementBonusTagMask5p, left: 53.693, top: 23.818, width: 4.519, height: 16.385 }
    ]

    // The Agreement Track shown here should read the same as the Agreement tab's own copy of it
    // (AgreementPanel.svelte) - if some other Corporation already signed earlier, its Token and
    // Share belong on this art from the moment this panel opens, not just once this Corporation
    // clicks Issue Share. "Other" excludes corporationId itself, since that
    // one Corporation's own Token/Share are already handled separately below, paced behind its
    // own reveal rather than shown immediately just because signTheAgreement.ts already resolved
    // it for real.
    const otherSignedCorporationsByPlanetCount = $derived.by(() => {
        const buckets = new Map<number, typeof gameSession.gameState.corporations>()
        for (const count of AGREEMENT_TRACK_PLANET_COUNTS) {
            buckets.set(count, [])
        }
        for (const otherCorporation of gameSession.gameState.corporations) {
            if (!otherCorporation.active || otherCorporation.id === corporationId) continue
            if (!otherCorporation.agreement) continue
            const bucket = Math.min(otherCorporation.agreement.planetCountAtSigning, AgreementTrackMaxPlanets)
            buckets.get(bucket)?.push(otherCorporation)
        }
        return buckets
    })
    const otherSignedCorporations = $derived(
        gameSession.gameState.corporations.filter(
            (otherCorporation) =>
                otherCorporation.active && otherCorporation.id !== corporationId && otherCorporation.agreement
        )
    )
    // Whether THIS Corporation's own Share has reached the reveal - a plain $derived instead of
    // a markup {@const} since this one isn't an immediate child of a block ({#each}/{#if}/etc,
    // which {@const} requires), just a bare child of the wrapping <div>.
    const showOwnShare = $derived(shareIssued)

    // Commit Tax Fraud (Borders & Taxes only) - half the Tax Box, taken into this
    // Corporation's Treasury for real when the tile flip submits the signing
    // (actions/signTheAgreement.ts), and recorded permanently on the Agreement Token itself
    // (corporation.agreement.taxFraudAmount) precisely so it can be dramatized here after the
    // fact. Alpha never sets this at all (undefined); Borders & Taxes sets it to 0 when the Tax
    // Box happened to be empty at signing time, in which case there's nothing to dramatize - the
    // button after the tile flip stays a plain "Continue" and this extra beat is skipped.
    const taxFraudAmount = $derived(corporation?.agreement?.taxFraudAmount)
    const showCommitTaxFraud = $derived(
        reveal?.stage === 'hex' && taxFraudAmount !== undefined && taxFraudAmount > 0
    )



    // Sign and Issue Share are local previews only - Back (or Undo) returns to the offer.
    function sign() {
        gameSession.signTheAgreementStaged = 'power'
    }
    function issueShare() {
        gameSession.signTheAgreementStaged = 'shares'
    }
    function backToOffer() {
        gameSession.signTheAgreementStaged = undefined
    }
    async function decline() {
        await gameSession.declineSignTheAgreement()
    }

    // Flipping the tile is the point of no return: this is where the real Sign The Agreement
    // action is submitted (it reveals the tile, so it can't be undone).
    async function flipHexTile() {
        // Snapshot before submitting - a successful sign clears these live fields as part of the
        // same state update, so they're captured now to seed signTheAgreementReveal.
        const hexIdToSign = gameSession.gameState.signTheAgreementHexId
        const corporationIdToSign = corporationId
        await gameSession.signTheAgreement()
        if (!gameSession.lastActionError && corporationIdToSign && hexIdToSign) {
            gameSession.signTheAgreementStaged = undefined
            gameSession.signTheAgreementReveal = {
                corporationId: corporationIdToSign,
                hexId: hexIdToSign,
                stage: 'hex'
            }
        }
    }
    function commitTaxFraud() {
        if (gameSession.signTheAgreementReveal) {
            gameSession.signTheAgreementReveal = { ...gameSession.signTheAgreementReveal, stage: 'taxFraud' }
        }
    }
    // Only once the President has clicked all the way through does this panel release back to
    // normal state-driven routing (see ActionPanel.svelte) - typically straight into
    // DraftPowerPanel, since Sign The Agreement always drafts a replacement Power next.
    function finishReveal() {
        gameSession.signTheAgreementReveal = undefined
    }
</script>

{#if corporationId}
    <div class="space-y-2 px-4 py-2 text-[#e6e9f5]">
        <div class="text-sm">
            {#if reveal}
                {#if presidentId}
                    <PlayerName playerId={presidentId} /> signed The Agreement for
                    <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
                {:else}
                    <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> signed
                    The Agreement
                {/if}
            {:else if presidentId}
                <PlayerName playerId={presidentId} /> may Sign The Agreement for
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span>
            {:else}
                <span class="font-semibold">{CorporationDisplayNames[corporationId]}</span> may Sign
                The Agreement
            {/if}
        </div>

        <!-- The Agreement Track itself - reads the same as the Agreement tab's own copy of it
             (AgreementPanel.svelte): any other Corporation that already signed earlier shows its
             Token/Share here right away, so it's clear this Corporation isn't the first. Which
             Alien Planets actually count toward THIS Corporation's own signing is highlighted
             directly on the board instead (Board.svelte pulses those hexes while this panel is
             up) - this art is for the track's actual state, not a highlight target of its own.
             This Corporation's own Token/Share only join it once Issue Share is clicked, same paced reveal as everywhere else in this panel. Full width on
             mobile - at 50% of an already-narrow phone sidebar the 4 tiny reference tiles plus
             Alien Shareholdings box were illegible; it only needs to shrink back to half-width
             once there's a wide enough action panel (sm:) for that to still read clearly. -->
        <div class="w-full sm:w-1/2">
            <div class="relative overflow-hidden rounded-lg">
                <img src={agreementTrackArt} alt="The Agreement" class="block w-full" />
                {#if !shareIssued && livePlanetCountColumnIndex !== undefined}
                    {@const tag = AGREEMENT_BONUS_TAG_HIGHLIGHT[livePlanetCountColumnIndex]}
                    <!-- Pulsing highlight over the printed "instant" Bonus Dividend figure for
                         THIS Corporation's current planet count - see
                         livePlanetCountColumnIndex's/AGREEMENT_BONUS_TAG_HIGHLIGHT's own
                         comments. A real cutout of that column's own scalloped "$X" plaque, so
                         the glow hugs its actual wavy silhouette rather than a plain box. -->
                    <img
                        src={tag.src}
                        alt=""
                        class="pointer-events-none absolute instant-bonus-preview-pulse"
                        style="left: {tag.left}%; top: {tag.top}%; width: {tag.width}%; height: {tag.height}%;"
                    />
                {/if}
                {#each AGREEMENT_TRACK_PLANET_COUNTS as _count, index (index)}
                    {@const otherSigned = otherSignedCorporationsByPlanetCount.get(_count) ?? []}
                    {@const showOwnToken = shareIssued && index === agreementTrackColumnIndex}
                    {#if otherSigned.length > 0 || showOwnToken}
                        <div
                            class="absolute flex flex-wrap items-center justify-center gap-1"
                            style="left: {AGREEMENT_TRACK_COLUMN_LEFT_PCT[
                                index
                            ]}%; width: {AGREEMENT_TRACK_COLUMN_WIDTH_PCT[
                                index
                            ]}%; top: {AGREEMENT_TOKEN_TOP_PCT}%; height: {AGREEMENT_TOKEN_HEIGHT_PCT}%;"
                        >
                            {#each otherSigned as otherCorporation (otherCorporation.id)}
                                <img
                                    src={CorporationAgreementTokenIcons[otherCorporation.id]}
                                    alt="{CorporationDisplayNames[otherCorporation.id]} Agreement Token"
                                    title="{CorporationDisplayNames[otherCorporation.id]} - Signed The Agreement"
                                    class="h-full w-auto object-contain drop-shadow"
                                />
                            {/each}
                            {#if showOwnToken}
                                {#key shareIssued}
                                    <img
                                        src={CorporationAgreementTokenIcons[corporationId]}
                                        alt="{CorporationDisplayNames[corporationId]} Agreement Token"
                                        title="Agreement Token"
                                        class="reveal-flip h-full w-auto object-contain drop-shadow"
                                    />
                                {/key}
                            {/if}
                        </div>
                    {/if}
                {/each}
                {#if otherSignedCorporations.length > 0 || showOwnShare}
                    <!-- The Share(s), placed right inside the Alien Shareholdings box (below its
                         own "ALIEN SHAREHOLDINGS" banner), not below the image or off to the
                         side. -->
                    <div
                        class="absolute flex flex-wrap items-center justify-center gap-1"
                        style="left: {AGREEMENT_TRACK_COLUMN_LEFT_PCT[4]}%; width: {AGREEMENT_TRACK_COLUMN_WIDTH_PCT[4]}%; top: {AGREEMENT_SHARE_TOP_PCT}%; height: {AGREEMENT_SHARE_HEIGHT_PCT}%;"
                    >
                        {#each otherSignedCorporations as otherCorporation (otherCorporation.id)}
                            <img
                                src={CorporationShareCertificateIcons[otherCorporation.id]}
                                alt="{CorporationDisplayNames[otherCorporation.id]} Share Certificate - Alien Shareholdings"
                                title="{CorporationDisplayNames[otherCorporation.id]} - Alien Shareholdings"
                                class="h-full w-auto rounded-sm object-contain shadow-lg"
                                style="aspect-ratio: {SHARE_CERTIFICATE_ASPECT};"
                            />
                        {/each}
                        {#if showOwnShare}
                            {#key shareIssued}
                                <img
                                    src={CorporationShareCertificateIcons[corporationId]}
                                    alt="{CorporationDisplayNames[corporationId]} Share Certificate - Alien Shareholdings"
                                    title="Alien Shareholdings"
                                    class="reveal-flip h-full w-auto rounded-sm object-contain shadow-lg"
                                    style="aspect-ratio: {SHARE_CERTIFICATE_ASPECT};"
                                />
                            {/key}
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <!-- The held Alien Explorers Power - discarded the moment this Corporation signs - next
             to a visual count (one small planet icon per Outpost, same treatment AgreementPanel
             uses) of the Alien Planets it currently holds, rather than a number. Both sized up
             (2.5x the Agreement Track's own reduced scale) since they're the actual decision-
             relevant pieces here. -->
        <div class="flex flex-wrap items-center gap-4 rounded-lg border border-[#2a3155] bg-[#12162b] p-3">
            {#if alienExplorersImage}
                {#key alienExplorersImage}
                    <img
                        src={alienExplorersImage}
                        alt="Alien Explorers"
                        class="w-auto shrink-0 rounded-sm object-contain drop-shadow {powerFlipped
                            ? 'reveal-flip'
                            : ''}"
                        style="height: {PIECE_HEIGHT_PX}px; aspect-ratio: {POWER_CARD_ASPECT};"
                    />
                {/key}
            {/if}
            <div class="flex flex-wrap items-center gap-2">
                {#each { length: planetCount } as _, index (index)}
                    <img
                        src={alienPlanetIcon}
                        alt="Alien Planet Outpost"
                        title="Alien Planet Outpost"
                        class="h-[50px] w-[50px] shrink-0 rounded-full object-cover drop-shadow"
                    />
                {/each}
            </div>
            {#if displayedShareCount > 0}
                <!-- A fanned stack, same idea as CorporationCharter.svelte's own Share stack,
                     just sized here to PIECE_HEIGHT_PX instead of a % of a Charter box. -->
                <div
                    class="relative shrink-0"
                    style="height: {PIECE_HEIGHT_PX}px; width: {PIECE_HEIGHT_PX *
                        SHARE_CERTIFICATE_ASPECT +
                        (displayedShareCount - 1) * SHARE_STACK_FAN_OFFSET_PX}px;"
                >
                    {#each { length: displayedShareCount } as _, index (index)}
                        <img
                            src={CorporationShareCertificateIcons[corporationId]}
                            alt="{CorporationDisplayNames[corporationId]} Share Certificate"
                            class="absolute rounded-sm shadow-lg"
                            style="height: {PIECE_HEIGHT_PX}px; aspect-ratio: {SHARE_CERTIFICATE_ASPECT}; left: {index *
                                SHARE_STACK_FAN_OFFSET_PX}px; top: 0; z-index: {index};"
                        />
                    {/each}
                </div>
            {/if}
            {#if CorporationAgreementTokenIcons[corporationId] && !corporation?.agreement && !shareIssued}
                <!-- The same handshake token AgreementPanel/CorporationStatsTable use for "has
                     not signed yet" - stops being accurate (and so stops rendering) the moment
                     corporation.agreement is set, which Sign The Agreement's own apply() does as
                     part of the same atomic resolution that starts this reveal. -->
                <img
                    src={CorporationAgreementTokenIcons[corporationId]}
                    alt="Has not signed The Agreement"
                    title="Has not signed The Agreement"
                    class="w-auto shrink-0 drop-shadow"
                    style="height: {HANDSHAKE_TOKEN_HEIGHT_PX}px;"
                />
            {/if}
        </div>

        {#if reveal || staged}
            <!-- The walkthrough: Sign -> Issue Share -> Flip the Alien Planet Tile. The first two
                 are local previews with a Back button; Flip submits the real action. Only the
                 deciding President gets the buttons; everyone else just watches the result. -->
            <div class="flex flex-wrap items-center gap-3 rounded-lg border border-[#2a3155] bg-[#12162b] p-3">
                {#key alienTileImage}
                    <img
                        src={alienTileImage}
                        alt={tileFlipped && chevrons !== undefined
                            ? `Alien Agreement Tile - ${chevrons} chevron${chevrons === 1 ? '' : 's'}`
                            : 'Alien Agreement Tile - hidden'}
                        class="h-16 w-16 shrink-0 rounded-sm object-contain drop-shadow {tileFlipped
                            ? 'reveal-flip'
                            : ''}"
                    />
                {/key}
                {#if tileFlipped}
                    <!-- Same "(+X)" gain treatment CorporationInfoBox.svelte uses for a
                         Corporation's own live Mining Capacity gain, here for the Alien
                         Corporation's - revealed the instant the tile is flipped. -->
                    <div class="flex items-center gap-1.5 text-xs text-[#c3c9e6]">
                        <img
                            src={alienMarker}
                            alt="Alien Corporation Mining Capacity"
                            title="Alien Corporation Mining Capacity"
                            class="h-6 w-auto drop-shadow"
                        />
                        {#if alienMiningCapacityGain > 0}
                            <span class="font-semibold text-[#3ddc84]">(+{alienMiningCapacityGain})</span>
                        {/if}
                    </div>
                {/if}
                {#if isMe}
                    {#if staged === 'power'}
                        <button
                            type="button"
                            onclick={issueShare}
                            class="rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa]"
                        >
                            Issue Share
                        </button>
                    {:else if staged === 'shares'}
                        <button
                            type="button"
                            onclick={flipHexTile}
                            disabled={!canSign || gameSession.busy}
                            class="rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Flip the Alien Planet Tile
                        </button>
                    {:else if showCommitTaxFraud}
                        <!-- Themed as the President's own choice to reveal the crime, not a rule
                             step they're merely watching resolve - the Tax Box was already halved
                             into this Corporation's Treasury for real when the tile was flipped
                             (actions/signTheAgreement.ts); clicking this just dramatizes how much. -->
                        <button
                            type="button"
                            onclick={commitTaxFraud}
                            class="rounded-md bg-[#a13a3a] px-3 py-1.5 text-xs font-semibold text-[#ffe1e1] hover:bg-[#bd4444]"
                        >
                            Commit Tax Fraud
                        </button>
                    {:else}
                        <button
                            type="button"
                            onclick={finishReveal}
                            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-xs font-semibold hover:bg-[#262c4d]"
                        >
                            Continue
                        </button>
                    {/if}
                    {#if staged}
                        <button
                            type="button"
                            onclick={backToOffer}
                            class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-xs font-semibold hover:bg-[#262c4d]"
                        >
                            Back
                        </button>
                        <span class="text-xs text-[#7f88ad]">
                            {staged === 'power'
                                ? 'Nothing is final until the tile is flipped.'
                                : 'Flipping the tile cannot be undone.'}
                        </span>
                    {/if}
                {:else}
                    <div class="text-xs text-[#7f88ad]">
                        {#if presidentId}<PlayerName playerId={presidentId} />{:else}The President{/if}
                        {isOrAre(presidentId)} finishing Sign The Agreement...
                    </div>
                {/if}
            </div>
            {#if reveal?.stage === 'taxFraud' && taxFraudAmount !== undefined}
                <!-- The dramatic payoff itself, once the President clicks "Commit Tax Fraud"
                     above - a single pop-in line rather than a full card, in the same red/green
                     "ill-gotten gain" palette as the button that revealed it. -->
                <div
                    class="tax-fraud-reveal flex w-fit items-center gap-2 rounded-lg border border-[#a13a3a] bg-[#2a1414] px-3 py-2 text-sm font-semibold"
                >
                    <span class="text-[#ff8f8f]">{CorporationDisplayNames[corporationId]}: Treasury</span>
                    <span class="flex items-center gap-0.5 text-[#3ddc84]">
                        +<CreditsIcon />{taxFraudAmount}
                    </span>
                </div>
            {/if}
        {:else if isMe && (canSign || canDecline)}
            <div class="flex gap-2 pt-1">
                <button
                    type="button"
                    onclick={sign}
                    disabled={!canSign}
                    class="rounded-md bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold hover:bg-[#3f7dfa] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Sign the Agreement
                </button>
                <button
                    type="button"
                    onclick={decline}
                    disabled={!canDecline}
                    class="rounded-md border border-[#3a4166] bg-[#1a1f38] px-3 py-1.5 text-xs font-semibold hover:bg-[#262c4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Decline
                </button>
            </div>
        {:else}
            <div class="text-xs text-[#7f88ad]">
                Waiting on {#if presidentId}<PlayerName playerId={presidentId} />{:else}the President{/if}
                to decide whether to Sign The Agreement...
            </div>
        {/if}

        {#if gameSession.lastActionError}
            <div class="text-xs text-[#e0343a]">{gameSession.lastActionError}</div>
        {/if}
    </div>
{/if}

<style>
    /* Pulsing highlight box over the Agreement Track's own printed "instant" Bonus Dividend
       figure for this Corporation's current planet count (see livePlanetCountColumnIndex's own
       comment) - a plain rectangle rather than an image silhouette, so a pulsing box-shadow
       (rather than the filter: drop-shadow(...) treatment other pulsing highlights in this app
       use on actual artwork) is what reads as a glowing highlight here, in the same green as
       every other "here's what to look at" pulse elsewhere (hostile-takeover-alien-pulse,
       backroom-deal-target-pulse, deep-space-smuggling-target-pulse). */
    .instant-bonus-preview-pulse {
        animation: instant-bonus-preview-pulse 1.4s ease-in-out infinite;
    }
    @keyframes instant-bonus-preview-pulse {
        0%,
        100% {
            filter: drop-shadow(0 0 2px rgba(61, 220, 132, 0.95)) drop-shadow(0 0 5px rgba(61, 220, 132, 0.6));
        }
        50% {
            filter: drop-shadow(0 0 4px rgba(61, 220, 132, 1)) drop-shadow(0 0 11px rgba(61, 220, 132, 0.9));
        }
    }

    /* Pop-in for the Commit Tax Fraud payoff line - same feel as FirstShipOrderedRevealOverlay's
       own .tile-appear, just scoped here since Svelte component styles aren't shared. */
    .tax-fraud-reveal {
        animation: tax-fraud-reveal 0.4s ease-out;
    }
    @keyframes tax-fraud-reveal {
        0% {
            transform: scale(0.8);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }

    /* A cheap, dependency-free approximation of a card flip: scale the image away to nothing and
       back, swapping to the new src at the midpoint via the {#key} block's remount. Reused for
       the Alien Explorers Power, the Alien Planet tile, and the Agreement Track's own Token/Share
       arrivals - every piece that "flips" or "arrives" somewhere over the course of this reveal. */
    .reveal-flip {
        animation: reveal-flip 0.5s ease-in-out;
    }

    @keyframes reveal-flip {
        0% {
            transform: scaleX(1);
        }
        50% {
            transform: scaleX(0);
        }
        100% {
            transform: scaleX(1);
        }
    }
</style>
