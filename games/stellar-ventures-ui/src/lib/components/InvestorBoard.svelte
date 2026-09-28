<script lang="ts">
    import { InvestorActionId, AlienTechActionId } from '@tabletop/stellar-ventures'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { InvestorBoardImage, InvestorActionDiscIcons } from '$lib/utils/investorDisplay.js'
    import MoneyStack from './MoneyStack.svelte'

    // A player's own Investor Board - printed art the co-designer provided (images/investor/
    // investorBoard.png). Overlaid here: Liquid/Frozen Funds as a messy pile of physical Money
    // tokens (MoneyStack.svelte) on the board's own printed "FROZEN FUNDS"/"LIQUID FUNDS" zones
    // (the striped panel on the left and the plain dark panel on the right of the header row -
    // both wide-open printed zones with nothing else in them, unlike the tight Cargo/Wormhole box
    // on the Charter, so their bounds were just eyeballed rather than needing a connected-
    // components pass); and each row's Action Disc (see the Action Disc comment below). Boardroom
    // Votes and Alien Tech Cubes are NOT shown here - both live in InvestorBoardPanel.svelte as
    // columns beside the board instead. The 4 Investor Shenanigans + 4 Alien Tech Shenanigans
    // action buttons themselves aren't interactive yet - see the game's task list for the still-
    // pending Investor/Alien Tech turn shell.
    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
    const playerState = $derived(gameSession.gameState.players.find((p) => p.playerId === playerId))
    // Both this player's Action Discs (Investor Action row and Alien Tech Action row) use the
    // SAME marker - one per player, matched to their own Color (see InvestorActionDiscIcons) -
    // not a fixed pair of markers shared by every player.
    const discIcon = $derived(InvestorActionDiscIcons[gameSession.colors.getPlayerColor(playerId)])

    const FROZEN_FUNDS_BOX = { left: 4, top: 15, width: 43, height: 22 }
    const LIQUID_FUNDS_BOX = { left: 53, top: 15, width: 43, height: 22 }

    // Each row of the Investor Board (rulebook page 19) tracks one Action Disc - it moves onto
    // whichever action the player picks each Investor Round and stays there until they pick a
    // DIFFERENT action (or pass, removing it) - see playerState.lastInvestorActionId/
    // lastAlienTechActionId and model/investorBoard.ts's own doc comment. Centers found the same
    // connected-components way as the Cargo/Wormhole box on the Charter (the 8 action circles
    // share one fill color), matched left-to-right per row against InvestorActionId/
    // AlienTechActionId's own declared (and printed) order. The two disc images themselves (the
    // marker image itself is this player's own Color-matched Action Disc (InvestorActionDiscIcons)
    // - the co-designer confirmed the same one token tracks both rows for a given player.
    const INVESTOR_ACTION_CENTER: Record<InvestorActionId, { left: number; top: number }> = {
        [InvestorActionId.PrivateContractor]: { left: 18.44, top: 55.84 },
        [InvestorActionId.JerryRig]: { left: 41.59, top: 55.84 },
        [InvestorActionId.InsuranceFraud]: { left: 64.5, top: 55.84 },
        [InvestorActionId.BlackMarket]: { left: 87.83, top: 55.84 }
    }
    const ALIEN_TECH_ACTION_CENTER: Record<AlienTechActionId, { left: number; top: number }> = {
        [AlienTechActionId.CargoBoost]: { left: 18.52, top: 75.6 },
        [AlienTechActionId.ResearchWormhole]: { left: 41.61, top: 75.6 },
        [AlienTechActionId.DevelopPlanets]: { left: 64.76, top: 75.6 },
        [AlienTechActionId.Launder]: { left: 87.96, top: 75.6 }
    }
    const ACTION_DISC_HEIGHT_PCT = 12
</script>

<div class="relative h-full w-full">
    <img
        src={InvestorBoardImage}
        alt="Investor Board"
        class="absolute inset-0 h-full w-full object-contain"
    />

    {#if playerState}
        <div
            class="absolute"
            style="left: {FROZEN_FUNDS_BOX.left}%; top: {FROZEN_FUNDS_BOX.top}%; width: {FROZEN_FUNDS_BOX.width}%; height: {FROZEN_FUNDS_BOX.height}%;"
        >
            <MoneyStack amount={playerState.frozenFunds} seed="{playerId}-frozen" />
        </div>

        <div
            class="absolute"
            style="left: {LIQUID_FUNDS_BOX.left}%; top: {LIQUID_FUNDS_BOX.top}%; width: {LIQUID_FUNDS_BOX.width}%; height: {LIQUID_FUNDS_BOX.height}%;"
        >
            <MoneyStack amount={playerState.liquidFunds} seed="{playerId}-liquid" />
        </div>

        {#if playerState.lastInvestorActionId && discIcon}
            {@const center = INVESTOR_ACTION_CENTER[playerState.lastInvestorActionId]}
            <img
                src={discIcon}
                alt="Investor Action disc"
                class="absolute drop-shadow"
                style="left: {center.left}%; top: {center.top}%; height: {ACTION_DISC_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
            />
        {/if}

        {#if playerState.lastAlienTechActionId && discIcon}
            {@const center = ALIEN_TECH_ACTION_CENTER[playerState.lastAlienTechActionId]}
            <img
                src={discIcon}
                alt="Alien Tech Action disc"
                class="absolute drop-shadow"
                style="left: {center.left}%; top: {center.top}%; height: {ACTION_DISC_HEIGHT_PCT}%; width: auto; transform: translate(-50%, -50%);"
            />
        {/if}
    {/if}
</div>
