import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import allRoute from './all.js'

const users: User[] = [
    { id: 'user-1', username: 'alice', status: UserStatus.Active, roles: [Role.User], externalIds: [] },
    {
        id: 'user-2',
        username: 'bob',
        status: UserStatus.Active,
        roles: [Role.User, Role.BetaTester],
        externalIds: []
    }
]

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async () => undefined)
    Reflect.set(server, 'verifyRoleAdmin', async () => undefined)
    const listUsers = vi.fn(async () => users)
    Reflect.set(server, 'userService', { listUsers })
    await server.register(allRoute)
    return { server, listUsers }
}

describe('GET /all', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('returns every user', async () => {
        const { server, listUsers } = await createServer()
        servers.add(server)

        const response = await server.inject({ method: 'GET', url: '/all' })

        expect(response.statusCode).toBe(200)
        expect(listUsers).toHaveBeenCalledOnce()
        expect(response.json().payload.users.map((user: User) => user.username)).toEqual([
            'alice',
            'bob'
        ])
    })
})
