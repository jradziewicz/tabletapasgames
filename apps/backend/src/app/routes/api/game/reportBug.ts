import { FastifyInstance } from 'fastify'
import { BugReportRequest } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: BugReportRequest }>(
        '/reportBug',
        {
            schema: { body: BugReportRequest },
            config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            await fastify.bugReportService.reportBug({ user: request.user, report: request.body })
            return { status: 'ok' }
        }
    )
}
