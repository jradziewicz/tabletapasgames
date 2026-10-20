import fastifyAuth from '@fastify/auth'
import { BugReportStatus, Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import listRoute from './list.js'
import screenshotRoute from './screenshot.js'
import statusRoute from './status.js'

const admin: User = {
    id: 'admin-1',
    username: 'jan',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

const storedReport = {
    id: 'report-1',
    status: BugReportStatus.Open,
    gameId: 'game-1',
    createdAt: new Date('2026-10-01T00:00:00.000Z')
}

const storedScreenshot = {
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]),
    width: 640,
    height: 480,
    contentType: 'image/jpeg' as const
}

async function createServer({ isAdmin = true }: { isAdmin?: boolean } = {}) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = admin
    })
    Reflect.set(server, 'verifyRoleAdmin', async () => {
        if (!isAdmin) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    })
    const listBugReports = vi.fn(async () => [storedReport])
    const setStatus = vi.fn(async ({ status }: { status: BugReportStatus }) => ({
        ...storedReport,
        status
    }))
    const getScreenshot = vi.fn(async ({ reportId, index }: { reportId: string; index: number }) =>
        reportId === 'report-1' && index === 0 ? storedScreenshot : undefined
    )
    Reflect.set(server, 'bugReportService', { listBugReports, setStatus, getScreenshot })
    await server.register(listRoute)
    await server.register(statusRoute)
    await server.register(screenshotRoute)
    return { server, listBugReports, setStatus, getScreenshot }
}

describe('admin bug report routes', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    describe('GET /list', () => {
        it('lists all reports', async () => {
            const { server, listBugReports } = await createServer()
            servers.add(server)

            const response = await server.inject({ method: 'GET', url: '/list' })

            expect(response.statusCode).toBe(200)
            expect(listBugReports).toHaveBeenCalledWith({ status: undefined })
            expect(response.json().payload.reports).toEqual([
                { ...storedReport, createdAt: storedReport.createdAt.toISOString() }
            ])
        })

        it('filters by status', async () => {
            const { server, listBugReports } = await createServer()
            servers.add(server)

            const response = await server.inject({ method: 'GET', url: '/list?status=open' })

            expect(response.statusCode).toBe(200)
            expect(listBugReports).toHaveBeenCalledWith({ status: BugReportStatus.Open })
        })

        it('rejects an unknown status', async () => {
            const { server, listBugReports } = await createServer()
            servers.add(server)

            const response = await server.inject({ method: 'GET', url: '/list?status=fixed' })

            expect(response.statusCode).toBe(400)
            expect(listBugReports).not.toHaveBeenCalled()
        })

        it('is admin only', async () => {
            const { server, listBugReports } = await createServer({ isAdmin: false })
            servers.add(server)

            const response = await server.inject({ method: 'GET', url: '/list' })

            expect(response.statusCode).toBe(403)
            expect(listBugReports).not.toHaveBeenCalled()
        })
    })

    describe('POST /:reportId/status', () => {
        it('closes a report as the signed-in admin', async () => {
            const { server, setStatus } = await createServer()
            servers.add(server)

            const response = await server.inject({
                method: 'POST',
                url: '/report-1/status',
                payload: { status: BugReportStatus.Closed }
            })

            expect(response.statusCode).toBe(200)
            expect(setStatus).toHaveBeenCalledWith({
                id: 'report-1',
                status: BugReportStatus.Closed,
                admin
            })
            expect(response.json().payload.report.status).toBe(BugReportStatus.Closed)
        })

        it('rejects an unknown status', async () => {
            const { server, setStatus } = await createServer()
            servers.add(server)

            const response = await server.inject({
                method: 'POST',
                url: '/report-1/status',
                payload: { status: 'fixed' }
            })

            expect(response.statusCode).toBe(400)
            expect(setStatus).not.toHaveBeenCalled()
        })

        it('is admin only', async () => {
            const { server, setStatus } = await createServer({ isAdmin: false })
            servers.add(server)

            const response = await server.inject({
                method: 'POST',
                url: '/report-1/status',
                payload: { status: BugReportStatus.Closed }
            })

            expect(response.statusCode).toBe(403)
            expect(setStatus).not.toHaveBeenCalled()
        })
    })

    describe('GET /:reportId/screenshots/:index', () => {
        it('serves the screenshot as a privately cached JPEG', async () => {
            const { server, getScreenshot } = await createServer()
            servers.add(server)

            const response = await server.inject({
                method: 'GET',
                url: '/report-1/screenshots/0'
            })

            expect(response.statusCode).toBe(200)
            expect(getScreenshot).toHaveBeenCalledWith({ reportId: 'report-1', index: 0 })
            expect(response.headers['content-type']).toBe('image/jpeg')
            expect(response.headers['cache-control']).toMatch(/^private\b/)
            expect(response.rawPayload.equals(storedScreenshot.jpeg)).toBe(true)
        })

        it('answers 404 for a screenshot that does not exist', async () => {
            const { server } = await createServer()
            servers.add(server)

            const response = await server.inject({
                method: 'GET',
                url: '/report-1/screenshots/1'
            })

            expect(response.statusCode).toBe(404)
        })

        it('rejects an index past the screenshot limit', async () => {
            const { server, getScreenshot } = await createServer()
            servers.add(server)

            const response = await server.inject({
                method: 'GET',
                url: '/report-1/screenshots/3'
            })

            expect(response.statusCode).toBe(400)
            expect(getScreenshot).not.toHaveBeenCalled()
        })

        it('is admin only', async () => {
            const { server, getScreenshot } = await createServer({ isAdmin: false })
            servers.add(server)

            const response = await server.inject({
                method: 'GET',
                url: '/report-1/screenshots/0'
            })

            expect(response.statusCode).toBe(403)
            expect(getScreenshot).not.toHaveBeenCalled()
        })
    })
})
