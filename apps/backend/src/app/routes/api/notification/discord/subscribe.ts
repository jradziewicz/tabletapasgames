import { FastifyInstance } from 'fastify'

// Turns on bot DMs for the signed-in user's linked Discord account. A test DM is sent first, so
// a player the bot can't reach gets a clear error here instead of silently never being notified.
export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/subscribe',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for subscribe request')
            }
            return { status: 'ok', payload: await fastify.discordService.subscribe(request.user) }
        }
    )
}
