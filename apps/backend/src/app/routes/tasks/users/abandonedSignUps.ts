import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    // Run daily by Cloud Scheduler (docs/runbooks/abandoned-sign-ups.md).
    fastify.post<{ Querystring: { dryRun?: string } }>('/sweepAbandonedSignUps', async (request) => {
        const dryRun = request.query.dryRun === 'true'
        const outcomes = await fastify.abandonedSignUps.sweep({ dryRun })
        return { status: 'ok', payload: { outcomes } }
    })
}
