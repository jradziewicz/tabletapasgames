<script lang="ts">
    import { onMount } from 'svelte'
    import { Card, Hr, Label, Input, Button, Alert, Toggle } from 'flowbite-svelte'
    import { Color, type UserPreferences } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'

    let { api, authorizationService } = getAppContext()

    // Falls back to the same defaults the Preferences page uses when a user has never saved
    // any preferences at all yet, so this always has a complete object to PATCH back - the
    // update endpoint replaces the whole UserPreferences, not just the field that changed.
    function currentPreferences(): UserPreferences {
        return (
            authorizationService.getSessionUser()?.preferences ?? {
                preventWebNotificationPrompt: false,
                preferredColors: Object.values(Color),
                preferredColorsEnabled: false
            }
        )
    }

    // Undefined behaves as "on" - see the field's own doc comment on UserPreferences.
    let emailNotificationsEnabled = $state(
        currentPreferences().emailNotificationsEnabled !== false
    )
    let emailPrefSaving = $state(false)
    let emailPrefError: string | undefined = $state(undefined)

    async function saveEmailPreference(enabled: boolean) {
        emailPrefError = undefined
        emailPrefSaving = true
        try {
            const user = authorizationService.getSessionUser()
            if (!user) return
            const updatedUser = await api.updateUserPreferences(user.id, {
                ...currentPreferences(),
                emailNotificationsEnabled: enabled
            })
            authorizationService.setSessionUser(updatedUser)
        } catch (e) {
            console.log(e)
            emailNotificationsEnabled = !enabled
            emailPrefError = 'Could not save that. Please try again.'
        } finally {
            emailPrefSaving = false
        }
    }

    function onToggleEmailNotifications(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) return
        const enabled = event.currentTarget.checked
        emailNotificationsEnabled = enabled
        void saveEmailPreference(enabled)
    }

    // Discord webhook notifications - the user makes a webhook in a channel they control and
    // pastes its URL here; the server posts turn/invite messages to it. No bot, no linking.
    let webhookUrlInput = $state('')
    let connectedWebhookUrl: string | undefined = $state(undefined)
    let webhookLoading = $state(true)
    let webhookSaving = $state(false)
    let webhookError: string | undefined = $state(undefined)
    let webhookSaved = $state(false)
    let showWebhookSteps = $state(false)

    onMount(async () => {
        try {
            connectedWebhookUrl = (await api.getDiscordWebhookStatus()).webhookUrl
        } catch (e) {
            console.log('Could not load Discord webhook status', e)
        } finally {
            webhookLoading = false
        }
    })

    async function saveWebhook(event: SubmitEvent) {
        event.preventDefault()
        webhookError = undefined
        webhookSaved = false
        const url = webhookUrlInput.trim()
        if (!url) {
            webhookError = 'Paste your webhook URL first.'
            return
        }
        webhookSaving = true
        try {
            connectedWebhookUrl = (await api.subscribeDiscordWebhook(url)).webhookUrl
            webhookUrlInput = ''
            webhookSaved = true
            showWebhookSteps = false
        } catch (e) {
            console.log(e)
            webhookError =
                e instanceof Error && e.message
                    ? e.message
                    : 'Something went wrong saving that webhook. Please try again.'
        } finally {
            webhookSaving = false
        }
    }

    async function removeWebhook() {
        webhookError = undefined
        webhookSaved = false
        webhookSaving = true
        try {
            await api.unsubscribeDiscordWebhook()
            connectedWebhookUrl = undefined
        } catch (e) {
            console.log(e)
            webhookError = 'Could not disconnect the webhook. Please try again.'
        } finally {
            webhookSaving = false
        }
    }
</script>

<div class="min-h-[calc(100dvh-70px)] flex flex-col items-center justify-center py-6 space-y-6">
    <Card class="bg-gray-300 p-4 sm:p-6 max-w-xl w-full">
        <div class="flex flex-col space-y-6">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Web Notifications</h3>
            <div class="text-white-600 text-sm dark:text-gray-300 mb-4">
                You can receive notifications from TableTapas directly in your web browser. <br
                /><br />Just accept the permission prompt that your browser shows you.
            </div>

            <Hr class="my-4" />
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Discord Notifications</h3>
            <div class="text-white-600 text-sm dark:text-gray-300">
                Get a message in Discord when it's your turn, when you're invited to a game, and
                when a game you're in starts. This works through a <span class="font-semibold"
                    >webhook</span
                > you create in any Discord channel you control - your own private server works
                great - so nothing needs to be installed or linked.
            </div>

            {#if webhookLoading}
                <div class="text-sm dark:text-gray-400">Checking your Discord settings…</div>
            {:else if connectedWebhookUrl}
                <Alert class="dark:bg-green-200 dark:text-green-700">
                    <span class="font-bold">Discord notifications are on.</span><br />
                    <span class="break-all text-xs">Posting to {connectedWebhookUrl}</span>
                </Alert>
                <div class="text-white-600 text-sm dark:text-gray-300">
                    To switch to a different channel, paste a new webhook URL below and save it.
                </div>
            {/if}

            {#if webhookSaved}
                <Alert class="dark:bg-green-200 dark:text-green-700">
                    Saved! A test message was just posted to your Discord channel - go check that
                    it arrived.
                </Alert>
            {/if}
            {#if webhookError}
                <Alert class="dark:bg-red-200 dark:text-red-700">
                    {webhookError}
                </Alert>
            {/if}

            <button
                type="button"
                class="text-left text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                onclick={() => (showWebhookSteps = !showWebhookSteps)}
            >
                {showWebhookSteps ? '▾' : '▸'} How do I get a webhook URL?
            </button>
            {#if showWebhookSteps}
                <div class="dark:bg-gray-700 bg-gray-100 p-4 rounded-sm text-sm dark:text-gray-200">
                    <ol class="list-decimal list-outside ml-5 space-y-2">
                        <li>
                            In Discord, pick the channel you want the messages in. If you'd like
                            them private, make a new server just for yourself (the <span
                                class="font-semibold">+</span
                            > button in Discord's server list) - it takes about ten seconds.
                        </li>
                        <li>
                            Hover the channel and click the <span class="font-semibold">gear</span
                            > (Edit Channel), then open <span class="font-semibold"
                                >Integrations</span
                            >.
                        </li>
                        <li>
                            Click <span class="font-semibold">Webhooks</span>, then
                            <span class="font-semibold">New Webhook</span>. You can name it
                            "TableTapas" if you like.
                        </li>
                        <li>
                            Click <span class="font-semibold">Copy Webhook URL</span>, come back
                            here, paste it into the box below and hit Save. We'll post a test
                            message right away so you know it worked.
                        </li>
                        <li>
                            <span class="font-semibold">Tip:</span> so Discord actually pings you,
                            right-click the channel, choose
                            <span class="font-semibold">Notification Settings</span>, and set it to
                            <span class="font-semibold">All Messages</span>. On mobile the same
                            settings are under the channel's name at the top.
                        </li>
                    </ol>
                    <div class="mt-3 text-xs dark:text-gray-400">
                        Keep the URL to yourself - anyone who has it can post to that channel. You
                        can delete the webhook from that same Integrations screen at any time,
                        and messages will simply stop.
                    </div>
                </div>
            {/if}

            <form onsubmit={saveWebhook} class="flex flex-col space-y-3">
                <Label for="discord-webhook-url">Discord webhook URL</Label>
                <Input
                    id="discord-webhook-url"
                    type="url"
                    autocomplete="off"
                    spellcheck={false}
                    placeholder="https://discord.com/api/webhooks/…"
                    bind:value={webhookUrlInput}
                    disabled={webhookSaving}
                />
                <div class="flex flex-row gap-2 justify-end">
                    {#if connectedWebhookUrl}
                        <Button
                            type="button"
                            color="alternative"
                            disabled={webhookSaving}
                            onclick={removeWebhook}
                        >
                            Turn off
                        </Button>
                    {/if}
                    <Button type="submit" disabled={webhookSaving || !webhookUrlInput.trim()}>
                        {webhookSaving ? 'Saving…' : connectedWebhookUrl ? 'Save new URL' : 'Save'}
                    </Button>
                </div>
            </form>

            <Hr class="my-4" />
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">Email Notifications</h3>
            <div class="text-white-600 text-sm dark:text-gray-300">
                By default we'll also email you if you haven't moved and your other notifications
                (Discord, web push) may not be getting through - a quick nudge a few minutes into
                your turn, and then a reminder every 24 hours it's still your turn. Turn this off
                if you'd rather rely only on Discord and web push, with no email at all.
            </div>
            {#if emailPrefError}
                <Alert class="dark:bg-red-200 dark:text-red-700">
                    {emailPrefError}
                </Alert>
            {/if}
            <Toggle
                checked={emailNotificationsEnabled}
                disabled={emailPrefSaving}
                onchange={onToggleEmailNotifications}
            >
                Email me about my turn and reminders
            </Toggle>
        </div>
    </Card>
</div>
