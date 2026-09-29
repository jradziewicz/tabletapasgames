<script lang="ts">
    import CreditsIcon from './CreditsIcon.svelte'

    // The amount-to-bid control: "− ₡45 +" in one rounded box, tap-friendly on phones (a plain
    // number input needed the on-screen keyboard). `value` is bindable; it never goes below
    // `min` (the smallest legal bid) and, when given, never above `max`. Also works from the
    // keyboard: Up/Down (or +/-) step it when the box is focused.
    let {
        value = $bindable(0),
        min = 0,
        max = undefined,
        step = 1,
        disabled = false
    }: {
        value: number
        min?: number
        max?: number
        step?: number
        disabled?: boolean
    } = $props()

    const canDecrease = $derived(!disabled && value - step >= min)
    const canIncrease = $derived(!disabled && (max === undefined || value + step <= max))

    function decrease() {
        if (canDecrease) value = value - step
    }
    function increase() {
        if (canIncrease) value = value + step
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowUp' || event.key === '+' || event.key === '=') {
            increase()
        } else if (event.key === 'ArrowDown' || event.key === '-') {
            decrease()
        } else {
            return
        }
        event.preventDefault()
    }
</script>

<div
    class="inline-flex items-stretch rounded-lg border border-[#3a4166] bg-[#10142a] text-[#e6e9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6fed]"
    role="spinbutton"
    tabindex="0"
    aria-label="Amount to bid"
    aria-valuenow={value}
    aria-valuemin={min}
    aria-valuemax={max}
    onkeydown={onKeydown}
>
    <button
        type="button"
        tabindex="-1"
        aria-label="Decrease bid"
        onclick={decrease}
        disabled={!canDecrease}
        class="flex h-10 w-11 items-center justify-center rounded-l-lg text-2xl leading-none text-[#e6e9f5] hover:bg-[#1a1f38] disabled:text-[#3a4166] disabled:hover:bg-transparent"
    >
        −
    </button>
    <div
        class="flex min-w-[4.5rem] select-none items-center justify-center gap-0.5 px-2 text-lg font-bold tabular-nums"
    >
        <CreditsIcon />{value}
    </div>
    <button
        type="button"
        tabindex="-1"
        aria-label="Increase bid"
        onclick={increase}
        disabled={!canIncrease}
        class="flex h-10 w-11 items-center justify-center rounded-r-lg text-2xl leading-none text-[#e6e9f5] hover:bg-[#1a1f38] disabled:text-[#3a4166] disabled:hover:bg-transparent"
    >
        +
    </button>
</div>
