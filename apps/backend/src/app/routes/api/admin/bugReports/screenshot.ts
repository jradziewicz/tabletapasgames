import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { BUG_REPORT_SCREENSHOT_MAX_COUNT } from '@tabletop/common'

type BugReportScreenshotParams = Static<typeof BugReportScreenshotParams>
const BugReportScreenshotParams = Type.Object(
    {
        reportId: Type.String({ minLength: 1 }),
        index: Type.Integer({ minimum: 0, maximum: BUG_REPORT_SCREENSHOT_MAX_COUNT - 1 })
    },
    { additionalProperties: false }
)

// Screenshots are only ever served here, to admins; nothing else can read them.
export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: BugReportScreenshotParams }>(
        '/:reportId/screenshots/:index',
        {
            schema: { params: BugReportScreenshotParams },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            const screenshot = await fastify.bugReportService.getScreenshot({
                reportId: request.params.reportId,
                index: request.params.index
            })
            if (!screenshot) {
                return reply
                    .code(404)
                    .send({ status: 'error', error: { name: 'NotFoundError', message: 'Not found' } })
            }
            return reply
                .header('Content-Type', screenshot.contentType)
                .header('Cache-Control', 'private, max-age=86400')
                .header('X-Content-Type-Options', 'nosniff')
                .send(screenshot.jpeg)
        }
    )
}
