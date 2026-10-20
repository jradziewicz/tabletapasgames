<script lang="ts">
    import { Alert, Toggle } from 'flowbite-svelte'
    import { Color, type ReminderHours, type User, type UserPreferences } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import {
        reminderHoursForm,
        reminderHoursFromForm,
        reminderHoursSummary,
        type ReminderHoursForm
    } from '$lib/utils/reminderHours'
    import ReminderHourGrid from './ReminderHourGrid.svelte'
    import TimeZonePicker from './TimeZonePicker.svelte'

    type HoursGroup = 'weekday' | 'weekend'

    // Wait for a pause in tapping/dragging before saving, so a run of changes is one request.
    const SAVE_DELAY_MS = 500

    const { authorizationService, api } = getAppContext()

    // The change waiting to be saved (or being saved). Undefined once the session user carries
    // the saved value, so the grid always shows what is on the account otherwise.
    let pending: { hours: ReminderHours | undefined } | undefined = $state(undefined)
    let saveError: string | undefined = $state(undefined)
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let saving = false
    let unsaved = false

    const savedHours = $derived(authorizationService.getSessionUser()?.preferences?.reminderHours)
    const shown = $derived(reminderHoursForm(pending ? pending.hours : savedHours))
    let weekendRequested = $state(false)
    let hiddenWeekend: number[] | undefined = $state(undefined)
    const separateWeekend = $derived(weekendRequested || shown.separateWeekend)

    const groups: { key: HoursGroup; name: string }[] = $derived(
        separateWeekend
            ? [
                  { key: 'weekday', name: 'Weekdays' },
                  { key: 'weekend', name: 'Weekends' }
              ]
            : [{ key: 'weekday', name: 'Every day' }]
    )

    // Same defaults the Preferences page uses for a user who has never saved any preferences;
    // the update endpoint replaces the whole UserPreferences, not just the changed field.
    function currentPreferences(user: User): UserPreferences {
        return (
            user.preferences ?? {
                preventWebNotificationPrompt: false,
                preferredColors: Object.values(Color),
                preferredColorsEnabled: false
            }
        )
    }

    function save(form: ReminderHoursForm) {
        pending = { hours: reminderHoursFromForm(form) }
        saveError = undefined
        unsaved = true
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
    }

    async function flush() {
        if (saving) return
        saving = true
        while (unsaved) {
            unsaved = false
            const user = authorizationService.getSessionUser()
            if (!user || !pending) {
                pending = undefined
                break
            }
            // Built from the session user at send time so preferences saved meanwhile
            // (e.g. the email toggle above) are kept.
            const { reminderHours: _previous, ...others } = currentPreferences(user)
            const reminderHours = $state.snapshot(pending.hours)
            const preferences: UserPreferences = reminderHours
                ? { ...others, reminderHours }
                : others
            try {
                authorizationService.setSessionUser(
                    await api.updateUserPreferences(user.id, preferences)
                )
                if (!unsaved) {
                    pending = undefined
                }
            } catch (e) {
                console.log('Could not save reminder hours', e)
                unsaved = false
                pending = undefined
                saveError = 'Could not save your reminder hours. Please try again.'
            }
        }
        saving = false
    }

    function setHours(group: HoursGroup, hours: number[]) {
        save({ ...shown, separateWeekend, [group]: hours })
    }

    function showWeekend() {
        weekendRequested = true
        save({
            weekday: shown.weekday,
            weekend: hiddenWeekend ?? shown.weekday,
            separateWeekend: true
        })
    }

    function hideWeekend() {
        hiddenWeekend = shown.weekend
        weekendRequested = false
        save({ ...shown, separateWeekend: false })
    }

    function onToggleWeekend(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) return
        if (event.currentTarget.checked) {
            showWeekend()
        } else {
            hideWeekend()
        }
    }
</script>

<div class="flex flex-col space-y-4">
    <div class="text-sm dark:text-gray-300">
        Pick the hours you'd like turn reminders to arrive. Tap or drag across hours to toggle
        them. The quick nudges a minute and five minutes into your turn still come right away; the
        daily reminders from 24 hours on wait for your next selected hour. With no hours selected,
        reminders come at any time.
    </div>
    {#if saveError}
        <Alert class="dark:bg-red-200 dark:text-red-700">
            {saveError}
        </Alert>
    {/if}
    {#each groups as group (group.key)}
        <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{group.name}</span>
                <span class="text-right text-xs text-gray-600 dark:text-gray-400"
                    >{reminderHoursSummary(shown[group.key])}</span
                >
            </div>
            <ReminderHourGrid
                label={`${group.name} reminder hours`}
                hours={shown[group.key]}
                onchange={(hours) => setHours(group.key, hours)}
            />
        </div>
    {/each}
    <Toggle checked={separateWeekend} onchange={onToggleWeekend}>
        Different hours on weekends
    </Toggle>
    <TimeZonePicker />
    <div class="text-xs text-gray-600 dark:text-gray-400">
        Weekends are Saturday and Sunday. Hours follow the time zone above.
    </div>
</div>
