<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        effectiveMiningCapacityForCorporation,
        dividendPayoutPerShare,
        dividendRowForCargo,
        MAX_CARGO,
        dividendRowForMiningCapacity,
        shareValuePerShare,
        totalCredits,
        CorporationId,
        CorporationStatus,
        OutpostSupplyByCorporationId,
        agreementTrackEntryForPlanetCount,
        taxDueForCorporation
    } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        CorporationColors,
        CorporationDisplayNames,
        CorporationLogoIcons,
        CorporationLogoAspect,
        CorporationAgreementTokenIcons,
        CorporationShareCertificateIcons,
        SHARE_CERTIFICATE_ASPECT
    } from '$lib/utils/corporationDisplay.js'
    import { operatingCorporationId } from '$lib/utils/phaseLabel.js'
    import { CorporatePowerDisplayNames, CorporatePowerDescriptions } from '$lib/utils/corporatePowerDisplay.js'
    import { PlayerSymbolIcons, PlayerVoteTokenIcons } from '$lib/utils/playerSymbolDisplay.js'
    import CreditsIcon from './CreditsIcon.svelte'
    import CreditsText from './CreditsText.svelte'
    import alienTechCube from '$lib/images/investor/alienTechCube.png'

    const gameSession = getGameSession()

    // Share Liquidation has actually run once state.result is set (operations/liquidation.ts's
    // determineWinners, called once EndOfGame is reached) - from that point on, Liquid Funds
    // already includes this Era's real Share Liquidation payout (liquidateShares adds straight
    // into it) while Frozen Funds is correctly left exactly as the rulebook says it should be
    // (still counted in full toward the final score - see totalCredits - Era 5 has no Investor
    // Round to Release it in beforehand), so showing both side by side afterward just reads as
    // "Frozen moved into Liquid but never got removed." See the money row below.
    const gameEnded = $derived(gameSession.gameState.result !== undefined)

    const players = $derived(gameSession.gameState.players)

    // Boardroom Votes and Alien Tech Cubes shown as their own physical piece art rather than a
    // bare number, per the co-designer's own call (labels removed too - the icons alone read as
    // "whose tokens/cubes are these" the same way the board itself does). Mirrors
    // InvestorBoardPanel's own piecesShown cap (there, a whole board panel can afford 12; this is
    // a single small stats line, so it caps tighter and folds any overflow into a "+N" suffix
    // rather than the icons wrapping this compact row onto a second line).
    const MAX_PIECES_SHOWN = 8
    function piecesShown(count: number) {
        return Math.min(Math.max(count, 0), MAX_PIECES_SHOWN)
    }
    const activeCorporations = $derived(
        gameSession.gameState.corporations.filter((corporation) => corporation.active)
    )

    const operatingCorpId = $derived(operatingCorporationId(gameSession.gameState))

    // The Director Marker exists in the model from Setup (see definition/initializer.ts - it
    // defaults to a player before the rulebook's Setup steps actually confirm one), but nobody
    // has physically been handed it yet at that point - the co-designer: don't show a Director
    // until a player has actually won and taken a Corporation's first Share. Once any Share
    // anywhere has been issued (either via the Initial Auction or New Investor Setup's direct
    // President assignment - both call issueShareToPlayer), the badge reflects the real marker.
    const anyShareIssued = $derived(
        gameSession.gameState.corporations.some((corporation) => corporation.issuedShareCount > 0)
    )

    // While a Corporation is operating (its President acting on its behalf, not bidding for
    // themselves in a share auction), the "Active" highlight belongs on that Corporation's own
    // card below, not on the President's Player card - see the Corporations section.
    function isTurn(playerId: string) {
        return (
            gameSession.gameState.activePlayerIds.includes(playerId) && operatingCorpId === undefined
        )
    }

    function statusLabel(status: CorporationStatus) {
        switch (status) {
            case CorporationStatus.Major:
                return 'Major'
            case CorporationStatus.Minor:
                return 'Minor'
            default:
                return 'Private'
        }
    }

    // Corporate Power badges show what they do in a small hover tooltip (following the pointer,
    // same pattern as the Shipyard's own hover popover) rather than every badge's description
    // taking up permanent space in the card.
    let hoveredPowerId: string | undefined = $state()
    let tooltipX: number | undefined = $state()
    let tooltipY: number | undefined = $state()

    function showPowerInfo(powerId: string, x: number, y: number) {
        hoveredPowerId = powerId
        tooltipX = x
        tooltipY = y
    }
    function hidePowerInfo() {
        hoveredPowerId = undefined
    }

    // What each player currently holds, across every active Corporation, plus that Corporation's
    // own total Share count (to read as a % of the company owned) and whether this player
    // presides over it - so a player's portfolio reads at a glance without cross-referencing the
    // Corporations list below share-by-share.
    function shareHoldingsForPlayer(playerId: string) {
        return activeCorporations
            .map((corporation) => ({
                corporationId: corporation.id,
                count: corporation.shareCountForPlayer(playerId),
                totalShares: corporation.shares.length,
                isPresident: corporation.getPresidentPlayerId() === playerId
            }))
            .filter(({ count }) => count > 0)
    }

    // A live "if Share Liquidation happened right now" estimate (Liquid + Frozen Funds, plus
    // every held Share's current liquidation value - see operations/liquidation.ts's
    // shareValuePerShare, the same per-Share payout Share Liquidation itself uses at Era end).
    // Alien-held Shares aren't this player's to count. Distinct from totalCredits, which only
    // exists after Share Liquidation has actually run.
    function liquidationValueForPlayer(playerId: string) {
        const player = gameSession.gameState.players.find((p) => p.playerId === playerId)
        if (!player) {
            return 0
        }
        const alienMiningCapacity = gameSession.gameState.alienCorporation.miningCapacity
        let shareValue = 0
        for (const corporation of activeCorporations) {
            const miningCapacity = effectiveMiningCapacityForCorporation(
                gameSession.gameState,
                corporation.id
            )
            const perShare = shareValuePerShare(miningCapacity, corporation, alienMiningCapacity)
            if (perShare <= 0) {
                continue
            }
            shareValue += perShare * corporation.shareCountForPlayer(playerId)
        }
        return player.liquidFunds + player.frozenFunds + shareValue
    }
</script>

<div class="space-y-4 p-2 text-[#e6e9f5]">
    <div>
        <div class="space-y-2">
            {#each players as playerState (playerState.playerId)}
                {@const shareHoldings = shareHoldingsForPlayer(playerState.playerId)}
                {@const liquidationValue = liquidationValueForPlayer(playerState.playerId)}
                {@const voteColor = gameSession.colors.getPlayerColor(playerState.playerId)}
                <div
                    class="overflow-hidden rounded-lg border {isTurn(playerState.playerId)
                        ? 'border-[#4f7cf2]'
                        : 'border-[#2a3155]'} bg-[#12162b] text-sm"
                >
                    <!-- Header: the player's own token (see playerSymbolDisplay.ts, from the
                         co-designer's own player-marker art) is now the small identifying mark,
                         rather than tinting the whole card - see corporationDisplay.js for the
                         same "identity marker, not a paint job" approach used on Corporations.
                         Falls back to a plain color dot for any Color that has no token art. -->
                    <div
                        class="flex items-center justify-between border-b border-[#2a3155] px-3 py-2"
                        style:background-color={gameSession.colors.getPlayerBgColorValue(playerState.playerId)}
                        style:color={gameSession.colors.getPlayerTextColorValue(playerState.playerId)}
                    >
                        <div class="flex items-center gap-2 font-semibold">
                            {#if PlayerSymbolIcons[gameSession.colors.getPlayerColor(playerState.playerId)]}
                                <img
                                    src={PlayerSymbolIcons[gameSession.colors.getPlayerColor(playerState.playerId)]}
                                    alt="Player token"
                                    class="h-3.5 w-3.5 shrink-0"
                                />
                            {:else}
                                <span
                                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style:background-color={gameSession.colors.getPlayerBgColorValue(
                                        playerState.playerId
                                    )}
                                ></span>
                            {/if}
                            <!-- Plain text rather than <PlayerName>: the whole header is already
                                 painted in this player's color, so the pill would just be a
                                 same-colored box inside it. -->
                            <span class="capitalize"
                                >{playerState.playerId === gameSession.myPlayer?.id
                                    ? 'You'
                                    : gameSession.getPlayerName(playerState.playerId)}</span
                            >
                        </div>
                        <div class="flex items-center gap-1">
                            {#if anyShareIssued && playerState.playerId === gameSession.gameState.directorPlayerId}
                                <span
                                    class="rounded-full border border-current bg-black/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                >
                                    Director
                                </span>
                            {/if}
                            {#if isTurn(playerState.playerId)}
                                <span
                                    class="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                >
                                    Active
                                </span>
                            {/if}
                        </div>
                    </div>

                    <!-- Primary stats - Liquid Funds, Frozen Funds, then a live Liquidation Value
                         estimate (what this player would end up with if Share Liquidation ran
                         right now). -->
                    <div class="flex divide-x divide-[#2a3155] border-b border-[#2a3155]">
                        {#if gameEnded}
                            <!-- One real, final number once Liquidation has actually resolved -
                                 the same totalCredits the game itself used to decide the winner
                                 (see GameEndPanel.svelte) - rather than Liquid/Frozen/the live
                                 estimate, all of which are stale or actively misleading by now
                                 (liquidationValueForPlayer would double-count every still-held
                                 Share's value on top of the payout it already paid into Liquid
                                 Funds). -->
                            <div class="flex-1 px-3 py-1.5">
                                <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                    Final Credits
                                </div>
                                <div class="font-mono text-sm font-semibold">
                                    <CreditsIcon
                                    />{totalCredits(gameSession.gameState, playerState.playerId)}
                                </div>
                            </div>
                        {:else}
                            <div class="flex-1 px-3 py-1.5">
                                <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                    Liquid Funds
                                </div>
                                <div class="font-mono text-sm font-semibold"><CreditsIcon />{playerState.liquidFunds}</div>
                            </div>
                            <div class="flex-1 px-3 py-1.5">
                                <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                    Frozen Funds
                                </div>
                                <div class="font-mono text-sm font-semibold"><CreditsIcon />{playerState.frozenFunds}</div>
                            </div>
                            <div class="flex-1 px-3 py-1.5">
                                <div
                                    class="text-[10px] uppercase tracking-widest text-[#7f88ad]"
                                    title="What this player would end up with if Share Liquidation happened right now: Liquid + Frozen Funds, plus every held Share's current liquidation value."
                                >
                                    Liquidation Value
                                </div>
                                <div class="font-mono text-sm font-semibold"><CreditsIcon />{liquidationValue}</div>
                            </div>
                        {/if}
                    </div>

                    <!-- Secondary stats - lower-traffic than the money row above, so kept small
                         and muted rather than given their own equal-weight columns. No text
                         labels on either group (per the co-designer) - the vote token's own
                         color/glyph and the cube's own green color already say what each is,
                         the same way the board itself never labels its own physical pieces. -->
                    <div
                        class="flex items-center gap-x-4 border-b border-[#2a3155] px-3 py-1 text-[11px] text-[#7f88ad]"
                    >
                        <span class="flex items-center gap-0.5">
                            {#each { length: piecesShown(playerState.boardroomVotes) } as _, index (index)}
                                {#if PlayerVoteTokenIcons[voteColor]}
                                    <img
                                        src={PlayerVoteTokenIcons[voteColor]}
                                        alt="Boardroom Vote"
                                        class="h-3 w-3 object-contain"
                                    />
                                {/if}
                            {/each}
                            {#if playerState.boardroomVotes > MAX_PIECES_SHOWN}
                                <span>+{playerState.boardroomVotes - MAX_PIECES_SHOWN}</span>
                            {/if}
                        </span>
                        <span class="flex items-center gap-0.5">
                            {#each { length: piecesShown(playerState.alienTechCubes) } as _, index (index)}
                                <img
                                    src={alienTechCube}
                                    alt="Alien Technology cube"
                                    class="h-3 w-3 object-contain"
                                />
                            {/each}
                            {#if playerState.alienTechCubes > MAX_PIECES_SHOWN}
                                <span>+{playerState.alienTechCubes - MAX_PIECES_SHOWN}</span>
                            {/if}
                        </span>
                    </div>

                    {#if shareHoldings.length > 0}
                        <div class="px-3 pt-2 text-[10px] uppercase tracking-widest text-[#7f88ad]">
                            Ownership
                        </div>
                        <div class="space-y-1.5 px-3 pb-2 pt-1">
                            {#each shareHoldings as holding (holding.corporationId)}
                                {@const aspect = CorporationLogoAspect[holding.corporationId] ?? 1}
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <img
                                            src={CorporationLogoIcons[holding.corporationId]}
                                            alt=""
                                            class="h-6 shrink-0 drop-shadow"
                                            style="width: {24 * aspect}px;"
                                        />
                                        <span class="font-semibold">
                                            {CorporationDisplayNames[holding.corporationId]}
                                        </span>
                                        {#if holding.isPresident}
                                            <span
                                                class="flex h-4 w-4 items-center justify-center rounded-full bg-[#2a3155] text-[9px] font-bold text-[#8fe0a8]"
                                                title="President"
                                            >
                                                P
                                            </span>
                                        {/if}
                                    </div>
                                    <!-- One Share Certificate icon per Share this player actually holds - at most 5 (3
                                         for Amethyst Agency, see SHARES_FOR_CORPORATION), so unlike the Boardroom
                                         Votes/Alien Tech cube rows above this never needs a MAX_PIECES_SHOWN overflow
                                         "+N". The title tooltip keeps the "X of Y" total the old percent used to
                                         convey at a glance without a hover. -->
                                    <div
                                        class="flex shrink-0 items-center gap-0.5"
                                        title="{holding.count} of {holding.totalShares} Shares"
                                    >
                                        {#each { length: holding.count } as _, index (index)}
                                            <img
                                                src={CorporationShareCertificateIcons[holding.corporationId]}
                                                alt="Share"
                                                class="h-4 shrink-0 rounded-[2px] shadow-sm"
                                                style="width: {SHARE_CERTIFICATE_ASPECT}rem;"
                                            />
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <div>
        <h2 class="mb-1 px-1 text-xs font-semibold uppercase tracking-widest text-[#7f88ad]">
            Corporations
        </h2>
        <div class="space-y-1">
            {#each activeCorporations as corporation (corporation.id)}
                {@const presidentId = corporation.getPresidentPlayerId()}
                {@const logoAspect = CorporationLogoAspect[corporation.id] ?? 1}
                {@const miningCapacity = effectiveMiningCapacityForCorporation(
                    gameSession.gameState,
                    corporation.id
                )}
                {@const cargoRow = dividendRowForCargo(corporation.cargo)}
                {@const incomingCargo = Math.min(
                    MAX_CARGO,
                    corporation.cargo + corporation.orderedShipLevels.reduce((sum, level) => sum + level, 0)
                ) - corporation.cargo}
                {@const miningRow = dividendRowForMiningCapacity(miningCapacity)}
                {@const limitingStat = cargoRow <= miningRow ? 'Cargo' : 'Mining'}
                {@const payoutPerShare = dividendPayoutPerShare(
                    corporation.cargo,
                    miningCapacity,
                    corporation.status
                )}
                {@const taxDue = gameSession.gameState.usesTaxes
                    ? taxDueForCorporation(gameSession.gameState, corporation.id)
                    : undefined}
                {@const borderColor =
                    corporation.id === CorporationId.FrostFederated
                        ? '#ffffff'
                        : CorporationColors[corporation.id]}
                <!-- Border takes the Corporation's own color (Frost Federated: white, matching
                     its white Outpost piece - board/other panels keep the shared color); the operating Corporation is
                     marked by a soft glow in that same color (plus the "Active" badge). -->
                <div
                    class="overflow-hidden rounded-lg border bg-[#12162b] text-sm"
                    style:border-color={borderColor}
                    style:box-shadow={corporation.id === operatingCorpId
                        ? `0 0 0 1px ${borderColor}, 0 0 12px ${borderColor}66`
                        : undefined}
                >
                    <!-- Header - same layout as a Player card's header (identity marker, not a
                         paint job): logo + name on the left, an "Active" badge here (in place of
                         the Status badge) while this Corporation itself is the one operating. -->
                    <div
                        class="flex items-center justify-between border-b border-[#2a3155] bg-[#1b2242] px-3 py-2"
                    >
                        <div class="flex items-center gap-2 font-semibold">
                            <img
                                src={CorporationLogoIcons[corporation.id]}
                                alt=""
                                class="h-5 shrink-0 drop-shadow"
                                style="width: {20 * logoAspect}px;"
                            />
                            {CorporationDisplayNames[corporation.id]}
                        </div>
                        {#if corporation.id === operatingCorpId}
                            <span
                                class="rounded-full border border-[#4f7cf2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9db4f5]"
                            >
                                Active
                            </span>
                        {:else}
                            <span
                                class="rounded-full border border-[#3a4166] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a8afd1]"
                            >
                                {statusLabel(corporation.status)}
                            </span>
                        {/if}
                    </div>

                    <!-- Primary stats - Treasury, Cargo Capacity, Mining Capacity - mirrors a
                         Player card's Liquid/Frozen/Liquidation Value row. Whichever of Cargo or
                         Mining is the limiting stat for the dividend row is highlighted, same as
                         before. -->
                    <div class="flex divide-x divide-[#2a3155] border-b border-[#2a3155]">
                        <div class="flex-1 px-3 py-1.5">
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                Treasury
                            </div>
                            <div class="font-mono text-sm font-semibold">
                                <CreditsIcon />{corporation.treasury}
                            </div>
                        </div>
                        <div class="flex-1 px-3 py-1.5">
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                Cargo Capacity
                            </div>
                            <div
                                class="font-mono text-sm font-semibold {limitingStat === 'Cargo'
                                    ? 'text-[#e6e9f5]'
                                    : 'text-[#c3c9e6]'}"
                            >
                                {corporation.cargo}{#if incomingCargo > 0}
                                    <!-- CARGO still on order - Ships Ordered but not yet Delivered
                                         (same clamped-at-MAX_CARGO preview Order Ships shows). -->
                                    <span class="text-xs font-semibold text-[#4ade80]" title="Arriving when Ordered Ships are Delivered">
                                        (+{incomingCargo})</span
                                    >{/if}
                            </div>
                        </div>
                        <div class="flex-1 px-3 py-1.5">
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                Mining Capacity
                            </div>
                            <div
                                class="font-mono text-sm font-semibold {limitingStat === 'Mining'
                                    ? 'text-[#e6e9f5]'
                                    : 'text-[#c3c9e6]'}"
                            >
                                {miningCapacity}
                            </div>
                        </div>
                    </div>

                    <!-- Secondary stats - mirrors a Player card's Votes/Alien Tech line. -->
                    <div
                        class="flex gap-x-4 border-b border-[#2a3155] px-3 py-1 text-[11px] text-[#7f88ad]"
                    >
                        <span>Shares: {corporation.availableShareCount}/{corporation.shares.length}</span>
                        <span>Loans: {corporation.loanCount}</span>
                        <span>
                            Outposts: {corporation.unbuiltOutposts}/{OutpostSupplyByCorporationId[
                                corporation.id
                            ]}
                        </span>
                    </div>

                    <!-- Current Payout / Agreement Bonus row - split into its own two
                         columns (mirrors the Treasury/Cargo/Mining row's own divide-x layout)
                         rather than one combined box, since they're unrelated numbers: Current
                         Payout is the live per-Share dividend read off the Cargo/Mining track,
                         while Agreement Bonus is the flat per-Share bonus this Corporation
                         locked in by signing The Agreement (operations/agreement.ts) - or, until
                         it signs, the same colored handshake token CorporationInfoBox/the
                         Agreement tab show, so a President who hasn't signed yet sees that
                         reminder right here alongside their own Corporation's stats. -->
                    <div class="flex divide-x divide-[#2a3155] border-b border-[#2a3155]">
                        <div
                            class="flex-1 px-3 py-1.5"
                            title="Dividend row is the lower of the Cargo row ({cargoRow}) and the Mining Capacity row ({miningRow}); the payout is read off that row's {statusLabel(
                                corporation.status
                            )} column."
                        >
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                Current Payout
                            </div>
                            <div class="font-mono text-sm font-semibold text-[#e6e9f5]">
                                <CreditsIcon />{payoutPerShare}
                            </div>
                        </div>
                        <div class="flex-1 px-3 py-1.5">
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                Agreement Bonus
                            </div>
                            {#if corporation.agreement}
                                <div class="font-mono text-sm font-semibold text-[#e6e9f5]">
                                    <CreditsIcon />{agreementTrackEntryForPlanetCount(
                                        corporation.agreement.planetCountAtSigning
                                    ).bonusDividendPerShare}
                                </div>
                            {:else if CorporationAgreementTokenIcons[corporation.id]}
                                <div
                                    class="flex items-center gap-1"
                                    title="Has not signed The Agreement"
                                >
                                    <img
                                        src={CorporationAgreementTokenIcons[corporation.id]}
                                        alt="Has not signed The Agreement"
                                        class="h-6 w-auto drop-shadow"
                                    />
                                    <span class="text-[10px] font-normal text-[#7f88ad]">(unsigned)</span>
                                </div>
                            {:else}
                                <span class="text-[10px] font-normal text-[#7f88ad]">Cannot sign</span>
                            {/if}
                        </div>
                        {#if taxDue !== undefined}
                            <!-- Borders & Taxes only - what this Corporation currently owes next
                                 Pay Taxes (operations/taxes.ts's taxDueForCorporation), read off
                                 the highest Tax Zone it has an Outpost in. Alpha never shows this
                                 column at all (taxDue stays undefined there). -->
                            <div class="flex-1 px-3 py-1.5">
                                <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                    Taxes
                                </div>
                                <div class="font-mono text-sm font-semibold text-[#e6e9f5]">
                                    <CreditsIcon />{taxDue}
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- President box. -->
                    {#if presidentId}
                        <div class="border-b border-[#2a3155] px-3 py-1.5">
                            <div class="text-[10px] uppercase tracking-widest text-[#7f88ad]">
                                President
                            </div>
                            <div class="text-sm font-semibold text-[#8fe0a8]">
                                <PlayerName playerId={presidentId} />
                            </div>
                        </div>
                    {/if}

                    <!-- Corporate Powers - hover (or long-press) any badge for what it does. -->
                    {#if corporation.powers.length > 0}
                        <div class="flex flex-wrap gap-1 px-3 py-2">
                            {#each corporation.powers as power (power.id)}
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <span
                                    class="cursor-help rounded border border-[#3a4166] bg-[#1a1f38] px-1.5 py-0.5 text-[10px] text-[#a8afd1]"
                                    onmouseenter={(e) => showPowerInfo(power.id, e.clientX, e.clientY)}
                                    onmousemove={(e) => showPowerInfo(power.id, e.clientX, e.clientY)}
                                    onmouseleave={hidePowerInfo}
                                >
                                    {CorporatePowerDisplayNames[power.id] ?? power.id}
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    {#if hoveredPowerId}
        <div
            class="pointer-events-none fixed z-30 w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-md border border-[#3a4166] bg-[#10142a] px-2.5 py-1.5 text-xs shadow-lg"
            style="left: {tooltipX}px; top: {(tooltipY ?? 0) - 12}px;"
        >
            <div class="font-semibold text-[#e6e9f5]">
                {CorporatePowerDisplayNames[hoveredPowerId] ?? hoveredPowerId}
            </div>
            <div class="mt-1 text-[#c3c9e6]">
                <CreditsText text={CorporatePowerDescriptions[hoveredPowerId] ?? ''} />
            </div>
        </div>
    {/if}
</div>
