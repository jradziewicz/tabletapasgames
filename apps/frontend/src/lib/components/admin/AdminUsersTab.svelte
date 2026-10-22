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
    const testerRoles = [Role.AlphaTester, Role.BetaTester] as const

    type Show = 'all' | 'alpha' | 'beta' | 'none'

    let users = $state<User[]>([])
    let loaded = $state(false)
    let error = $state('')
    let filter = $state('')
    let show = $state<Show>('all')
    let selected = $state<User>()
    let savingIds = $state<string[]>([])

    let alphaCount = $derived(users.filter((user) => user.roles.includes(Role.AlphaTester)).length)
    let betaCount = $derived(users.filter((user) => user.roles.includes(Role.BetaTester)).length)

    let shown = $derived.by(() => {
        const text = filter.trim().toLowerCase()
        return users.filter((user) => {
            if (
                text &&
                !(user.username ?? '').toLowerCase().includes(text) &&
                !(user.email ?? '').toLowerCase().includes(text)
            )
                return false
            const alpha = user.roles.includes(Role.AlphaTester)
            const beta = user.roles.includes(Role.BetaTester)
            if (show === 'alpha') return alpha
            if (show === 'beta') return beta
            if (show === 'none') return !alpha && !beta
            return true
        })
    })

    async function load() {
        error = ''
        try {
            users = await api.listAllUsers()
            loaded = true
            selected = users.find((user) => user.id === selected?.id)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not load users'
        }
    }

    function replaceUser(updated: User) {
        users = users.map((user) => (user.id === updated.id ? updated : user))
        if (selected?.id === updated.id) selected = updated
    }

    // Ticking Alpha or Beta saves right away, keeping the user's other assignable roles.
    async function setTester(user: User, role: AdminAssignableRole, checked: boolean) {
        const current = ADMIN_ASSIGNABLE_ROLES.filter((other) => user.roles.includes(other))
        const roles = checked
            ? [...current.filter((other) => other !== role), role]
            : current.filter((other) => other !== role)
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

    onMount(() => {
        void load()
    })
</script>

<div class="flex flex-wrap items-end gap-3">
    <label class="flex grow flex-col gap-1 text-sm sm:max-w-md">
        <span class="text-gray-600 dark:text-gray-300">Filter by username or email</span>
        <input
            type="search"
            name="filter"
            bind:value={filter}
            autocomplete="off"
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
    </label>
    <label class="flex flex-col gap-1 text-sm">
        <span class="text-gray-600 dark:text-gray-300">Show</span>
        <select
            bind:value={show}
            class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
            <option value="all">Everyone</option>
            <option value="alpha">Alpha testers</option>
            <option value="beta">Beta testers</option>
            <option value="none">Not a tester</option>
        </select>
    </label>
</div>
{#if loaded}
    <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {users.length} users · {alphaCount} alpha · {betaCount} beta
    </p>
{/if}
{#if error}<p role="alert" class="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
<div class="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
    <div aria-busy={!loaded}>
        {#if !loaded && !error}
            <p class="text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
        {:else if loaded && !shown.length}
            <p class="text-sm text-gray-500 dark:text-gray-400">No users match.</p>
        {/if}
        {#if shown.length}
            <div
                class="max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700/60"
            >
                <table class="w-full text-left text-sm">
                    <thead
                        class="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    >
                        <tr>
                            <th class="px-4 py-2 font-semibold">User</th>
                            {#each testerRoles as role (role)}
                                <th class="w-16 px-2 py-2 text-center font-semibold"
                                    >{role === Role.AlphaTester ? 'Alpha' : 'Beta'}</th
                                >
                            {/each}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700/60">
                        {#each shown as user (user.id)}
                            <tr
                                class={selected?.id === user.id
                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                    : ''}
                            >
                                <td class="px-4 py-2">
                                    <button
                                        type="button"
                                        onclick={() => (selected = user)}
                                        class="flex flex-col gap-0.5 text-left"
                                    >
                                        <span class="font-medium hover:underline"
                                            >{user.username ?? user.id}</span
                                        >
                                        <span class="text-xs text-gray-500 dark:text-gray-400">
                                            {user.email ?? 'No email'} · {user.status}
                                        </span>
                                    </button>
                                </td>
                                {#each testerRoles as role (role)}
                                    <td class="px-2 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            aria-label={`${roleLabels[role]}: ${user.username ?? user.id}`}
                                            checked={user.roles.includes(role)}
                                            disabled={savingIds.includes(user.id)}
                                            onchange={(event) =>
                                                void setTester(
                                                    user,
                                                    role,
                                                    event.currentTarget.checked
                                                )}
                                            class="rounded border-gray-300 text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
                                        />
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
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
