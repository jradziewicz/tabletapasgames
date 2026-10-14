<script lang="ts">
    import {
        ScalingWrapper,
        DefaultTableLayout,
        GameSession,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import { LocustGameSession } from '$lib/model/session.svelte.js'
    import type { HydratedLocustGameState, LocustGameState } from '@tabletop/locust'
    import { setGameSession } from '$lib/model/sessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<LocustGameState, HydratedLocustGameState> } = $props()
    if (!(gameSession instanceof LocustGameSession)) {
        throw Error('Locust needs a LocustGameSession')
    }
    setGameSession(gameSession)
</script>

<div class="bg-[#e9dfc7]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#2b2418]"
                disabledColor="text-[#b8ab90]"
                borderClass="border-[#b8ab90] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls enabledColor="text-[#2b2418]" disabledColor="text-[#b8ab90]" />
            </div>
            <DefaultTabs
                activeTabClass="py-1 px-3 bg-[#3a3022] border-2 border-transparent rounded-lg text-gray-100"
                inactiveTabClass="text-[#2b2418] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#3a3022]"
                fontClass="font-normal"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionPanel />
            </div>
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
