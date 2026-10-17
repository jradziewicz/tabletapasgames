import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { BugReportStatusUpdate } from '@tabletop/common'

type BugReportParams = Static<typeof BugReportParams>
const BugReportParams = Type.Object({ reportId: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Params: BugReportParams; Body: BugReportStatusUpdate }>(
        '/:reportId/status',
        {
            schema: { params: BugReportParams, body: BugReportStatusUpdate },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for token request')
            }
            const report = await fastify.bugReportService.setStatus({
                id: request.params.reportId,
                status: request.body.status,
                admin: request.user
            })
            return { status: 'ok', payload: { report } }
        }
    )
}
