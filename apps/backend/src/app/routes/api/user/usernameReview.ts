import { FastifyInstance } from 'fastify'
import { UsernameReviewRequest } from '@tabletop/common'

// "Think this is a mistake? Let us know." on a blocked username. Open to signed-out visitors
// too, since a name is first chosen at sign-up.
export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UsernameReviewRequest }>(
        '/usernameReview',
        {
            config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
            schema: { body: UsernameReviewRequest }
        },
        async function (request) {
            const user = request.user
            await fastify.usernameReviewService.submit(
                request.body,
                user ? { id: user.id, email: user.email } : undefined
            )
            return { status: 'ok', payload: {} }
        }
    )
}
