import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { UsernameReviewStatusUpdate } from '@tabletop/common'

type UsernameReviewParams = Static<typeof UsernameReviewParams>
const UsernameReviewParams = Type.Object({ reviewId: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Params: UsernameReviewParams; Body: UsernameReviewStatusUpdate }>(
        '/:reviewId/status',
        {
            schema: { params: UsernameReviewParams, body: UsernameReviewStatusUpdate },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const review = await fastify.usernameReviewService.setStatus(
                request.params.reviewId,
                request.body.status
            )
            return { status: 'ok', payload: { review } }
        }
    )
}
