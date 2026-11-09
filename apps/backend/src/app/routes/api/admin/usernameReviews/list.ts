import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { UsernameReviewStatus } from '@tabletop/common'

type UsernameReviewListQuery = Static<typeof UsernameReviewListQuery>
const UsernameReviewListQuery = Type.Object(
    { status: Type.Optional(Type.Enum(UsernameReviewStatus)) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: UsernameReviewListQuery }>(
        '/list',
        {
            schema: { querystring: UsernameReviewListQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const reviews = await fastify.usernameReviewService.list(request.query.status)
            return { status: 'ok', payload: { reviews } }
        }
    )
}
