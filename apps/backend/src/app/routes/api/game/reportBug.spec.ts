import fastifyAuth from '@fastify/auth'
import {
    BUG_REPORT_DESCRIPTION_MAX_LENGTH,
    Role,
    type BugReportRequest,
    type User,
    UserStatus
} from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reportBugRoute from './reportBug.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const report: BugReportRequest = {
    gameId: 'game-1',
    description: 'The ship would not move',
    view: { actionCount: 12, inHistory: true, exploring: false },
    versions: { site: '1.40.0', logic: '2.2.0', ui: '3.3.0' },
    client: { userAgent: 'test', viewport: '800x600 @1x', installedApp: false }
}

async function createServer({ authorized = true }: { authorized?: boolean } = {}) {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => {
        if (!authorized) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    })

    const reportBug = vi.fn(async () => ({ id: 'report-1' }))
    Reflect.set(server, 'bugReportService', { reportBug })

    await server.register(reportBugRoute)
    return { server, reportBug }
}

describe('POST /reportBug', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('files the bug report for the authenticated User', async () => {
        const { server, reportBug } = await createServer()
        servers.add(server)

        const response = await server.inject({ method: 'POST', url: '/reportBug', payload: report })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status: 'ok' })
        expect(reportBug).toHaveBeenCalledWith({ user, report })
    })

    it('rejects a description over the length limit', async () => {
        const { server, reportBug } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, description: 'x'.repeat(BUG_REPORT_DESCRIPTION_MAX_LENGTH + 1) }
        })

        expect(response.statusCode).toBe(400)
        expect(reportBug).not.toHaveBeenCalled()
    })

    it('rejects an empty description', async () => {
        const { server, reportBug } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, description: '' }
        })

        expect(response.statusCode).toBe(400)
        expect(reportBug).not.toHaveBeenCalled()
    })

    it('rejects a user without the User role', async () => {
        const { server, reportBug } = await createServer({ authorized: false })
        servers.add(server)

        const response = await server.inject({ method: 'POST', url: '/reportBug', payload: report })

        expect(response.statusCode).toBe(403)
        expect(reportBug).not.toHaveBeenCalled()
    })
})
