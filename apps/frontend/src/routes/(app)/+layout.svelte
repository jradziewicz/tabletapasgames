<script lang="ts">
    import '../../app.css'
    import {
        Navbar,
        NavBrand,
        Avatar,
        Button,
        Dropdown,
        DropdownHeader,
        DropdownDivider,
        DropdownItem,
        Modal,
        Banner,
        NavUl,
        NavLi,
        Toggle,
        Heading,
        Alert,
        DropdownGroup
    } from 'flowbite-svelte'
    import darkLogo from '$lib/components/images/dark-logo.png'
    import { afterNavigate, goto, onNavigate } from '$app/navigation'
    import LoginPanel, { loginViewTitles, type LoginView } from '$lib/components/LoginPanel.svelte'
    import AuthModal from '$lib/components/AuthModal.svelte'
    import { setLoginModal } from '$lib/stores/loginModal'
    import { onMount } from 'svelte'
    import { PUBLIC_API_HOST } from '$env/static/public'
    import { fromStore } from 'svelte/store'
    import { UserStatus, Color } from '@tabletop/common'
    import {
        VersionChange,
        GameEditForm,
        getAppContext,
        attachGlobalCssVarFromRect
    } from '@tabletop/frontend-components'
    import { toast } from 'svelte-sonner'
    import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
    import { BellSolid } from 'flowbite-svelte-icons'

    let {
        api,
        authorizationService,
        gameService,
        notificationService,
        visibilityService,
        libraryService,
        manifestService
    } = getAppContext()
    let titlesById = $derived(libraryService.titlesById)
    let loading = $derived(libraryService.loading)

    let { children } = $props()

    let sessionUser = $derived(authorizationService.getSessionUser())
    let showCreateGameModel = $state(false)
    let showCancelPrompt = $state(false)
    let showLoginModal = $state(false)
    let loginView = $state<LoginView>('signin')

    const openLoginModal = setLoginModal(() => {
        loginView = 'signin'
        showLoginModal = true
    })

    afterNavigate(() => {
        showLoginModal = false
    })

    function selectTransitionCover(titleId: string | undefined) {
        for (const cover of document.querySelectorAll<HTMLImageElement>('img[data-game-cover]')) {
            cover.style.viewTransitionName =
                cover.dataset.gameCover === titleId ? `game-cover-${titleId}` : 'none'
        }
    }

    onNavigate((navigation) => {
        const from = navigation.from?.url.pathname
        const to = navigation.to?.url.pathname
        const libraryMove =
            (from === '/' && to === '/library') ||
            (from?.startsWith('/library') && to?.startsWith('/library'))
        if (
            !libraryMove ||
            !document.startViewTransition ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
            return

        const titleId = navigation.to?.params?.titleId ?? navigation.from?.params?.titleId
        selectTransitionCover(titleId)
        return new Promise<void>((resolve) => {
            const transition = document.startViewTransition(async () => {
                resolve()
                await navigation.complete
                selectTransitionCover(titleId)
            })
            void transition.finished.catch(() => {})
        })
    })

    let currentGameState = $derived.by(() => {
        const state = gameService.currentGameSession?.bridge.gameState
        return state ? fromStore(state) : undefined
    })
    let reproductionSeed = $derived(currentGameState?.current?.masterSeed)

    let seed = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame

        if (!authorizationService.canUseDeveloperTools) {
            return undefined
        }

        return reproductionSeed ?? game.seed
    })

    let gameLogicVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getLogicVersion(game.typeId)
    })

    let gameUiVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getUiVersion(game.typeId)
    })

    let currentDefinition = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        return titlesById[gameService.currentGameSession.primaryGame.typeId]
    })

    async function onLogout() {
        await api.logout()
        gameService.clear()
        await authorizationService.onLogout()
    }

    const logoutChannel = new BroadcastChannel('logout')
    logoutChannel.onmessage = function (e) {
        onLogout()
    }

    async function logout() {
        onLogout()
        logoutChannel.postMessage({})
    }

    async function gotoProfile() {
        await goto('/profile')
    }

    async function gotoPreferences() {
        showCancelPrompt = false
        await goto('/preferences')
    }

    async function gotoNotifications() {
        showCancelPrompt = false
        await goto('/notifications')
    }

    async function gotoDashboard() {
        await goto('/dashboard')
    }

    async function gotoAdminGames() {
        await goto('/admin/games')
    }

    function setAdminCapabilities(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) {
            return
        }

        gameService.currentGameSession?.bridge.setChosenAdminPlayerId(undefined)
        authorizationService.adminCapabilitiesEnabled = event.currentTarget.checked
    }

    function createGame() {
        if (loading) {
            toast.info('Loading game library...')
            return
        }
        showCreateGameModel = true
    }

    async function closeCreateModal() {
        showCreateGameModel = false
    }

    async function onGameCreate() {
        await closeCreateModal()
        notificationService.showPrompt()
    }

    const loginChannel = new BroadcastChannel('login')
    loginChannel.onmessage = async function (e) {
        if (e.data.status === 'success' && e.data.user) {
            await authorizationService.onLogin(e.data.user)
        }
    }

    const userUpdateChannel = new BroadcastChannel('userUpdated')
    userUpdateChannel.onmessage = function (e) {
        const user = e.data.user
        authorizationService.setSessionUser(user)
    }

    async function requestNotificationPermission() {
        notificationService.hidePrompt()
        await notificationService.requestWebNotificationPermission()
    }

    async function dismissPrompt() {
        notificationService.hidePrompt()
        showCancelPrompt = true
    }

    // One-time "new feature" nudge toward the Discord webhook notifications (Notifications
    // page). Fires once per user - the moment it's shown, seenDiscordWebhookAnnouncement is
    // saved back as true so a slow/failed save is the only way it could ever show twice, and a
    // successful save means never again. discordAnnouncementFired guards against this effect
    // re-running (e.g. after that same save updates sessionUser) before the flag round-trips.
    let discordAnnouncementFired = false
    $effect(() => {
        const user = sessionUser
        if (
            !user ||
            discordAnnouncementFired ||
            user.preferences?.seenDiscordWebhookAnnouncement === true
        ) {
            return
        }
        discordAnnouncementFired = true

        onceMounted(() => {
            toast.info(
                'New: get pinged in Discord for your turn, invites, and game starts - no bot required.',
                {
                    duration: 20000,
                    action: {
                        label: 'Set it up',
                        onClick: () => void goto('/notifications')
                    }
                }
            )
        })

        const preferences = user.preferences ?? {
            preventWebNotificationPrompt: false,
            preferredColors: Object.values(Color),
            preferredColorsEnabled: false
        }
        api.updateUserPreferences(user.id, {
            ...preferences,
            seenDiscordWebhookAnnouncement: true
        })
            .then((updatedUser) => authorizationService.setSessionUser(updatedUser))
            .catch((e) => console.log('Could not record Discord announcement as seen', e))
    })

    // While a signed-in user has this site visible, tell the server they're around
    // so it can hold off on "it's your turn" emails.
    const HEARTBEAT_INTERVAL_MS = 60_000
    $effect(() => {
        const userId = sessionUser?.id
        const visible = visibilityService.visible
        if (!userId || !visible) {
            return
        }
        const beat = () => {
            fetch(`${PUBLIC_API_HOST}/api/v1/user/heartbeat`, {
                method: 'POST',
                credentials: 'include'
            }).catch(() => {})
        }
        beat()
        const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS)
        return () => clearInterval(timer)
    })

    onMount(() => {
        notificationService.onMounted()
        visibilityService.setDocument(document)
        if (/mobile/i.test(navigator.userAgent ?? '') && !location.hash) {
            window.scrollTo(0, 1)
        }
    })

    $effect(() => {
        const versionChange = api.versionChange
        switch (versionChange) {
            case VersionChange.MajorUpgrade:
            case VersionChange.Rollback:
                console.log('Major upgrade detected')
                onceMounted(() => {
                    toast.warning(
                        'The site has been updated and requires a page refresh.  Refreshing in 5 seconds',
                        {
                            duration: Number.POSITIVE_INFINITY,
                            classes: {
                                closeButton: 'hidden'
                            }
                        }
                    )
                    setTimeout(() => {
                        location.reload()
                    }, 5000)
                })
                break
            // Patch releases are the everyday fix deploys (a hidden option, a silenced toast), and
            // most players never reload on their own, so they get the same gentle nudge as a
            // minor release. Only major releases and rollbacks force a reload above.
            case VersionChange.MinorUpgrade:
            case VersionChange.PatchUpgrade:
                console.log(`${versionChange === VersionChange.MinorUpgrade ? 'Minor' : 'Patch'} upgrade detected`)
                onceMounted(() => {
                    toast.info(
                        'The site has been updated with new features or fixes, please refresh the page when you have a moment',
                        {
                            duration: Number.POSITIVE_INFINITY
                        }
                    )
                })
                break
            default:
                break
        }
    })
</script>

{#snippet gameName()}
    {#if gameService.currentGameSession}
        <Heading
            class="text-nowrap text-center mt-2 sm:mt-0 max-w-[320px] dark:text-gray-200 font-medium tight overflow-clip text-ellipsis"
            style=""
            tag="h4"
            >{currentDefinition?.info.metadata.beta ? 'BETA: ' : ''}{gameService.currentGameSession
                .primaryGame.name}</Heading
        >
    {/if}
{/snippet}

{#snippet gameSeed()}
    {#if seed !== undefined}
        <div class="text-center mb-2 sm:mb-0 max-w-[320px] dark:text-gray-400 text-xs">
            <div>{reproductionSeed !== undefined ? 'Reproduction seed' : 'Public seed'}</div>
            <div class="font-mono break-all select-all">{seed}</div>
        </div>
    {/if}
{/snippet}

<div {@attach attachGlobalCssVarFromRect('--app-navbar-height')}>
    <Navbar
        fluid={true}
        class="{currentDefinition?.info.metadata.beta ? 'dark:bg-red-900' : 'dark:bg-gray-800'} "
    >
        <div class="flex flex-col w-full">
            <div class="flex flex-row justify-between items-center w-full">
                <div class="flex justify-center items-center">
                    <NavBrand href={sessionUser ? '/library' : '/'} class="shrink-0 cursor-pointer">
                        <img src={darkLogo} alt="TableTapas Games" class="h-11 w-auto" />
                    </NavBrand>

                    <div
                        class="hidden sm:block rounded-lg py-2 px-2 md:px-4 flex flex-col justify-start items-start ml-4"
                    >
                        {@render gameName()}
                    </div>
                </div>
                <div class="flex items-center">
                    {#if sessionUser}
                        {#if sessionUser.status === UserStatus.Active}
                            <Button
                                size="xs"
                                color="blue"
                                class="me-4 h-[30px] bg-[#7165ad] hover:bg-[#5b4f95] dark:bg-[#7165ad] dark:hover:bg-[#5b4f95] focus-within:ring-[#7165ad] dark:focus-within:ring-[#5b4f95]"
                                onclick={gotoDashboard}>My Games</Button
                            >
                        {/if}

                        <Avatar id="user-drop" class="cursor-pointer" />
                        <Dropdown triggeredBy="#user-drop">
                            <DropdownGroup class="py-1">
                                <DropdownHeader class="py-2">
                                    <span class="block text-sm"
                                        >{sessionUser.username || 'username not assigned'}</span
                                    >
                                </DropdownHeader>
                                <DropdownDivider />
                                <DropdownItem class="w-full text-left" onclick={gotoProfile}
                                    >Profile</DropdownItem
                                >
                                <DropdownItem class="w-full text-left" onclick={gotoPreferences}
                                    >Preferences</DropdownItem
                                >
                                <DropdownItem class="w-full text-left" onclick={gotoNotifications}
                                    >Notifications</DropdownItem
                                >
                                {#if authorizationService.isAdmin}
                                    <DropdownItem class="w-full text-left" onclick={gotoAdminGames}
                                        >All Games (Admin)</DropdownItem
                                    >
                                {/if}
                                <DropdownDivider />
                                {#if authorizationService.canUseDeveloperTools}
                                    <li>
                                        <Toggle
                                            bind:checked={authorizationService.debugViewEnabled}
                                            class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                            >Debug</Toggle
                                        >
                                    </li>
                                {/if}
                                {#if authorizationService.isAdmin}
                                    <li>
                                        <Toggle
                                            checked={authorizationService.adminCapabilitiesEnabled}
                                            onchange={setAdminCapabilities}
                                            class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                            >Admin</Toggle
                                        >
                                    </li>
                                {/if}
                                <DropdownItem class="w-full text-left" onclick={logout}
                                    >Sign out</DropdownItem
                                >
                                {#if authorizationService.canUseDeveloperTools}
                                    <DropdownDivider />
                                    <DropdownItem
                                        class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                        >FE: v{manifestService.getFrontendVersion()}</DropdownItem
                                    >
                                    {#if gameLogicVersion}
                                        <DropdownItem
                                            class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                            >Logic: v{gameLogicVersion ?? 'N/A'}</DropdownItem
                                        >
                                    {/if}
                                    {#if gameUiVersion}
                                        <DropdownItem
                                            class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                            >UI: v{gameUiVersion ?? 'N/A'}</DropdownItem
                                        >
                                    {/if}
                                    {#if seed !== undefined}
                                        <DropdownItem class="w-full text-left py-1"
                                            >{@render gameSeed()}</DropdownItem
                                        >
                                    {/if}
                                {/if}
                            </DropdownGroup>
                        </Dropdown>
                    {:else}
                        <Button onclick={openLoginModal} size="sm" color="blue">Sign in</Button>
                    {/if}
                </div>
            </div>
            <div class="flex justify-center sm:hidden w-full overflow-hidden text-ellipsis">
                {@render gameName()}
            </div>
        </div>
    </Navbar>
</div>
{#if !sessionUser}
    <AuthModal
        bind:open={showLoginModal}
        title={loginViewTitles[loginView]}
        label={loginView === 'signin' ? 'Sign in' : loginViewTitles[loginView]}
        variant={loginView === 'signin' ? 'welcome' : 'form'}
    >
        <LoginPanel bind:view={loginView} />
    </AuthModal>
{/if}
<Modal
    bind:open={showCreateGameModel}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <GameEditForm oncancel={() => closeCreateModal()} onsave={(game) => onGameCreate()} />
</Modal>
<Modal
    bind:open={showCancelPrompt}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <Alert color="blue" class="dark:bg-transparent dark:text-blue-400">
        <div class="flex items-center gap-3">
            <span class="text-lg font-medium">Just so you know...</span>
        </div>
        <p class="mt-2 mb-4 text-sm">
            If you do not want to be prompted about notifications any more, you can configure that
            in your prefences.
        </p>
        <div class="flex gap-2">
            <Button
                onclick={() => {
                    showCancelPrompt = false
                }}
                size="xs"
                color="blue">Got it</Button
            >
            <Button onclick={() => gotoPreferences()} size="xs" outline color="light"
                >Go to Preferences</Button
            >
        </div>
    </Alert>
</Modal>
{#if notificationService.shouldShowPrompt()}
    <Banner id="default-banner" class="relative" type="top" dismissable={false}>
        <div class="flex items-center justify-between w-full">
            <div class="flex items-center">
                <p class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
                    <span class="inline-flex p-1 me-3 bg-gray-200 rounded-full dark:bg-gray-600">
                        <BellSolid class="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span class="sr-only">Light bulb</span>
                    </span>
                    <span>
                        Receive notifications about game invitations and to let you know it is your
                        turn?
                    </span>
                </p>
                <Button
                    onclick={() => requestNotificationPermission()}
                    color="blue"
                    class="ms-4 max-h-[24px]"
                    size="xs">Allow</Button
                >
            </div>

            <div class="flex">
                <Button
                    onclick={() => dismissPrompt()}
                    color="light"
                    class="ms-4 max-h-[24px]"
                    size="xs">Close</Button
                >
            </div>
        </div></Banner
    >
{/if}
{@render children()}
