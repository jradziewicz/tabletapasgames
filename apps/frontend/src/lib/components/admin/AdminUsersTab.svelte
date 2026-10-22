<script lang="ts">
    import { onMount } from 'svelte'
    import {
        ADMIN_ASSIGNABLE_ROLES,
        Role,
        type AdminAssignableRole,
        type User
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import AdminUserRoles from './AdminUserRoles.svelte'

    const { api } = getAppContext()
    const roleLabels: Record<Role, string> = {
        [Role.User]: 'User',
        [Role.Admin]: 'Admin',
        [Role.Developer]: 'Developer',
        [Role.BetaTester]: 'Beta tester',
        [Role.AlphaTester]: 'Alpha tester'
    }
    // The tester roles get a checkbox on every row so they can be handed out while scrolling.
    const testerRoles = [
        { role: Role.AlphaTester, label: 'Alpha' },
        { role: Role.BetaTester, label: 'Beta' }
    ] as const
    type TesterFilter = 'all' | 'alpha' | 'beta' | 'none'

    let query = $state('')
    let filter = $state<TesterFilter>('all')
    let users = $state<User[]>([])
    let selected = $state<User>()
    let loading = $state(true)
    let error = $state('')
    let savingIds = $state<string[]>([])

    let alphaCount = $derived(users.filter((user) => user.roles.includes(Role.AlphaTester)).length)
    let betaCount = $derived(users.filter((user) => user.roles.includes(Role.BetaTester)).length)
    let visibleUsers = $derived.by(() => {
        const needle = query.trim().toLowerCase()
        return users.filter((user) => {
            if (
                needle &&
                !(user.username ?? '').toLowerCase().includes(needle) &&
                !(user.email ?? '').toLowerCase().includes(needle)
            )
                return false
            const alpha = user.roles.includes(Role.AlphaTester)
            const beta = user.roles.includes(Role.BetaTester)
            if (filter === 'alpha') return alpha
            if (filter === 'beta') return beta
            if (filter === 'none') return !alpha && !beta
            return true
        })
    })

    onMount(load)

    async function load() {
        loading = true
        error = ''
        try {
            users = await api.listUsers()
            selected = users.find((user) => user.id === selected?.id)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not load users'
        } finally {
            loading = false
        }
    }

    async function toggleTester(user: User, role: AdminAssignableRole, checked: boolean) {
        const assigned = ADMIN_ASSIGNABLE_ROLES.filter((other) => user.roles.includes(other))
        const roles = checked
            ? [...assigned, role]
            : assigned.filter((other) => other !== role)
        savingIds = [...savingIds, user.id]
        error = ''
        try {
            replaceUser(await api.assignUserRoles(user.id, roles))
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not update roles'
        } finally {
            savingIds = savingIds.filter((id) => id !== user.id)
        }
    }

    function replaceUser(updated: User) {
        users = users.map((user) => (user.id === updated.id ? updated : user))
        if (selected?.id === updated.id) selected = updated
    }
</script>

<div class="flex flex-wrap items-end gap-3">
    <label class="flex grow flex-col gap-1 text-sm sm:max-w-md">
        <span class="text-gray-600 dark:text-gray-300">Filter by username or email</span>
        <input
            type="search"
            name="query"
            bind:value={query}
            autocomplete="off"
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
    </label>
    <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-600 dark:text-gray-300">Show</span>
        <select
            bind:value={filter}
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
            <option value="all">All users ({users.length})</option>
            <option value="alpha">Alpha testers ({alphaCount})</option>
            <option value="beta">Beta testers ({betaCount})</option>
            <option value="none">Not a tester</option>
        </select>
    </label>
    <button
        type="button"
        onclick={load}
        disabled={loading}
        class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >Refresh</button
    >
</div>
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div aria-busy={loading}>
        {#if loading && !users.length}
            <p class="text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
        {:else if !visibleUsers.length}
            <p class="text-sm text-gray-500 dark:text-gray-400">No users match.</p>
        {:else}
            <ul
                class="max-h-[70vh] divide-y divide-gray-200 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-700/60 dark:border-gray-700/60"
            >
                {#each visibleUsers as user (user.id)}
                    <li
                        class="flex items-center gap-3 px-4 py-2 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-900/30"
                        aria-selected={selected?.id === user.id}
                    >
                        <button
                            type="button"
                            onclick={() => (selected = user)}
                            class="flex min-w-0 grow flex-col gap-0.5 text-left hover:underline"
                        >
                            <span class="truncate font-medium">{user.username ?? user.id}</span>
                            <span class="truncate text-xs text-gray-500 dark:text-gray-400">
                                {user.email ?? 'No email'} · {user.status}
                            </span>
                        </button>
                        {#each testerRoles as tester (tester.role)}
                            <label class="flex shrink-0 items-center gap-1 text-xs">
                                <input
                                    type="checkbox"
                                    checked={user.roles.includes(tester.role)}
                                    disabled={savingIds.includes(user.id)}
                                    onchange={(event) =>
                                        toggleTester(user, tester.role, event.currentTarget.checked)}
                                    class="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-800"
                                />
                                {tester.label}
                            </label>
                        {/each}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
    {#if selected}
        <AdminUserRoles
            user={selected}
            assignableRoles={ADMIN_ASSIGNABLE_ROLES}
            {roleLabels}
            onsaved={replaceUser}
        />
    {/if}
</div>
