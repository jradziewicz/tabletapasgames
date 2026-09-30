import { FastifyInstance } from 'fastify'

// Whether the site has a Discord bot, whether the signed-in user has linked Discord, and
// whether bot DMs are currently on for them - everything the Notifications page needs.
export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/status',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for status request')
            }
            return { status: 'ok', payload: await fastify.discordService.getStatus(request.user) }
        }
    )
}
