import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/unsubscribe',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for unsubscribe request')
            }
            return {
                status: 'ok',
                payload: await fastify.discordService.unsubscribe(request.user)
            }
        }
    )
}
