import { FastifyInstance } from 'fastify'
import { BugReportEmail } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: BugReportEmail }>(
        '/sendBugReportEmail',
        { schema: { body: BugReportEmail } },
        async function (request, reply) {
            await fastify.emailService.sendBugReportEmail(request.body)
            await reply.code(200).send()
        }
    )
}
