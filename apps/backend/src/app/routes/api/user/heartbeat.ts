import { FastifyInstance } from 'fastify'
import { markUserActive } from '@tabletop/backend-services'

// Called periodically by the site while a signed-in user has a tab visible, so
// turn-alert emails can be skipped for people who are already looking at the site.
export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/heartbeat',
        {
            onRequest: fastify.auth([fastify.verifyUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for heartbeat request')
            }
            await markUserActive(fastify.cacheService, request.user.id)
            return { status: 'ok' }
        }
    )
}
