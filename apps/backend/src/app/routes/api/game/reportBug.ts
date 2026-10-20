import { FastifyInstance } from 'fastify'
import {
    BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH,
    BUG_REPORT_SCREENSHOT_MAX_COUNT,
    BugReportRequest
} from '@tabletop/common'

// Room for the most screenshots at their largest (3 x 700 KB, about 2.7 MiB as base64) plus the
// report text; Fastify's default 1 MiB would refuse a single large screenshot.
const REPORT_TEXT_BYTES = 64 * 1024
const REPORT_BUG_BODY_LIMIT =
    BUG_REPORT_SCREENSHOT_MAX_COUNT * BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH + REPORT_TEXT_BYTES

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: BugReportRequest }>(
        '/reportBug',
        {
            bodyLimit: REPORT_BUG_BODY_LIMIT,
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
