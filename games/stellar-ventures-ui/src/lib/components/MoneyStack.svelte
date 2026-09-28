<script lang="ts">
    import { MoneyDenominations, MoneyTokenIcons, type MoneyDenomination } from '$lib/utils/moneyDisplay.js'

    // A "just tossed onto the table" pile of physical Money tokens worth `amount` Credits -
    // greedy largest-denomination-first (see moneyBreakdown in moneyDisplay.ts), but exploded
    // back out to one image per physical token rather than one per denomination, since the whole
    // point here is a messy stack a player could actually see themselves. Capped at MAX_TOKENS so
    // an unusually large amount still reads as a pile instead of degrading into a wall of icons.
    // Click (or Enter) splays the pile out into an orderly, non-overlapping, largest-to-smallest
    // row so a player can actually count it - same "small resting state, bigger on click" idea as
    // the Share stack on CorporationCharter.svelte.
    //
    // Fills 100% of whatever width/height the caller's own wrapper gives it - that wrapper MUST
    // set an explicit height, not just width, in % (the way CorporationCharter.svelte's other
    // overlays are boxed), or the left/top percentages below silently resolve against a
    // zero/auto height instead - see that file's own notes on this exact trap.
    let { amount, seed = '' }: { amount: number; seed?: string } = $props()

    const MAX_TOKENS = 16

    function tokensFor(rawAmount: number): MoneyDenomination[] {
        let remaining = Math.max(0, Math.trunc(rawAmount))
        const tokens: MoneyDenomination[] = []
        for (const denomination of MoneyDenominations) {
            let count = Math.floor(remaining / denomination)
            remaining -= count * denomination
            while (count-- > 0 && tokens.length < MAX_TOKENS) {
                tokens.push(denomination)
            }
        }
        return tokens
    }

    // Deterministic per-token "randomness" (position/rotation/size jitter), seeded by `seed` +
    // token index/denomination, so the pile looks messy but never reshuffles itself on every
    // re-render the way Math.random() would (and stays identical between server and client
    // renders, avoiding a hydration mismatch).
    function hash(input: string): number {
        let h = 2166136261
        for (let i = 0; i < input.length; i++) {
            h ^= input.charCodeAt(i)
            h = Math.imul(h, 16777619)
        }
        return (h >>> 0) / 4294967296
    }

    // tokensFor already emits largest-denomination-first, which doubles as the natural
    // easiest-to-count order once splayed out.
    const tokens = $derived(tokensFor(amount))

    // Each denomination gets its own horizontal lane in the resting pile (largest-to-smallest,
    // left-to-right) so a $50 can never end up sitting on top of - and hiding - a $1 or any other
    // different denomination. Coins of the SAME denomination still jitter/overlap freely within
    // their own lane, since that's just a normal little stack of identical tokens.
    const presentDenominations = $derived([...new Set(tokens)])

    // The $1 token reads visually "busier" (smaller printed numeral relative to its rounded-
    // triangle outline) than the others at the same physical size, so it's rendered 10% smaller
    // here to sit better next to the $5/$10/$50 tokens in a mixed pile.
    const DENOMINATION_SCALE: Record<MoneyDenomination, number> = { 50: 1, 10: 1, 5: 1, 1: 0.9 }

    let expanded = $state(false)
</script>

{#if tokens.length > 0}
    <div
        class="relative h-full w-full cursor-pointer"
        role="button"
        tabindex="0"
        onclick={() => (expanded = !expanded)}
        onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
    >
        {#if expanded}
            <!-- Splayed out for counting: plain flex flow (not absolute + top/left%), sorted
                 largest-to-smallest, no rotation/overlap - a normal flex child's height:% still
                 resolves against this container's own real height, so this stays safe without
                 needing translate()-based centering. -->
            <div class="flex h-full w-full flex-wrap items-center justify-center gap-1 rounded bg-black/30 p-1">
                {#each tokens as denomination, index (index)}
                    <img
                        src={MoneyTokenIcons[denomination]}
                        alt="{denomination} Credit token"
                        class="drop-shadow-md"
                        style="height: 60%; width: auto;"
                    />
                {/each}
            </div>
        {:else}
            {#each tokens as denomination, index (index)}
                {@const key = `${seed}-${index}-${denomination}`}
                {@const laneCount = presentDenominations.length}
                {@const laneIndex = presentDenominations.indexOf(denomination)}
                {@const laneCenter = (100 / (laneCount + 1)) * (laneIndex + 1)}
                {@const laneHalfWidth = (100 / laneCount) * 0.32}
                <!-- Confined to this denomination's own lane (see presentDenominations above) -
                     only the within-lane jitter is random, so different denominations never
                     overlap each other, only coins that share one. -->
                {@const left = laneCenter + (hash(key + 'x') * 2 - 1) * laneHalfWidth}
                {@const top = 30 + hash(key + 'y') * 40}
                {@const rotate = -18 + hash(key + 'r') * 36}
                <!-- Kept to a small +-18deg tilt rather than a full 0-360deg spin - each token
                     has a printed denomination on it (most visibly the $1's number), so a coin
                     landing upside down would read as wrong/broken rather than "messy". Askew,
                     not flipped. -->
                <!-- Fixed per-denomination size only (DENOMINATION_SCALE) - no per-token
                     random jitter here, so every coin of the same denomination renders at
                     the exact same size as every other one of that denomination. -->
                {@const scale = DENOMINATION_SCALE[denomination]}
                {@const laneWidthPct = 100 / laneCount}
                <!-- height:80% sizes off the box's HEIGHT, but a lane's own boundary is a
                     percentage of the box's WIDTH - on a wide, short box (the Investor Board's
                     Frozen/Liquid Funds zones especially) those aren't the same thing, so a tall
                     coin can render wider than its own lane and bleed into - and cover the
                     numeral on - a neighboring denomination's coin. max-width caps the rendered
                     size to this lane's own width so that can't happen, on any box shape;
                     height:80% still wins (renders at full requested size) whenever the box is
                     square/tall enough for that not to matter. -->
                <img
                    src={MoneyTokenIcons[denomination]}
                    alt="{denomination} Credit token"
                    class="absolute drop-shadow-md"
                    style="left: {left}%; top: {top}%; height: 80%; width: auto; max-width: {laneWidthPct * 0.92}%; object-fit: contain; z-index: {index}; transform: translate(-50%, -50%) rotate({rotate}deg) scale({scale});"
                />
            {/each}
        {/if}
    </div>
{/if}
