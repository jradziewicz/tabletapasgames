import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { BugReportStatus } from '@tabletop/common'

type BugReportListQuery = Static<typeof BugReportListQuery>
const BugReportListQuery = Type.Object(
    { status: Type.Optional(Type.Enum(BugReportStatus)) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: BugReportListQuery }>(
        '/list',
        {
            schema: { querystring: BugReportListQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const reports = await fastify.bugReportService.listBugReports({
                status: request.query.status
            })
            return { status: 'ok', payload: { reports } }
        }
    )
}
