import { FastifyInstance } from 'fastify'
import { DiscordWebhookTransport } from '@tabletop/backend-services'

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
            await fastify.notificationService.unregisterNotificationSubscription(
                DiscordWebhookTransport.identifierForUser(request.user.id)
            )
            return { status: 'ok', payload: {} }
        }
    )
}
