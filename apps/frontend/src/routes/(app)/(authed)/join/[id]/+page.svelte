<script lang="ts">
    import { Card } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import GameCard from '$lib/components/GameCard.svelte'
    import { GameStatus, type Game } from '@tabletop/common'
    import { goto } from '$app/navigation'

    let { data }: { data: { game: Game } } = $props()

    let joinGame: Game | undefined = $derived(data.game)

    // Filling the last seat of an invite-only game starts it right away (autoStartGameIfReady on
    // the backend), in which case go straight into it. A filled public game instead starts after a
    // one-minute countdown (autoStartAt, shown on its GameCard).
    async function onJoined(game: Game) {
        joinGame = undefined
        if (game.status === GameStatus.Started) {
            await goto(`/game/${game.id}`)
            return
        }
        toast.success(
            game.autoStartAt
                ? `You joined ${game.name}. Every seat is filled, so it starts in a minute.`
                : `You joined ${game.name}. It starts once every seat is filled.`
        )
        await goto('/dashboard')
    }

    async function onDeclined() {
        joinGame = undefined
        await goto('/dashboard')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">Join this game?</h1>
        <div class="flex flex-col items-center">
            {#if joinGame}
                <GameCard
                    game={joinGame}
                    expanded={'always'}
                    ondecline={onDeclined}
                    onjoin={onJoined}
                />
            {/if}
        </div>
    </Card>
</div>
