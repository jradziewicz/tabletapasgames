import { FastifyInstance } from 'fastify'
import { DiscordWebhookTransport, TransportType } from '@tabletop/backend-services'

// Whether the signed-in user has a Discord webhook connected, and a token-masked copy of its
// URL so the Notifications page can show which one without leaking the secret part.
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
            const subscriptions = await fastify.notificationService.findNotificationSubscriptions(
                `user-${request.user.id}`
            )
            const webhook = subscriptions.find(
                (subscription) => subscription.transport === TransportType.DiscordWebhook
            )
            return {
                status: 'ok',
                payload: {
                    webhookUrl:
                        webhook && 'webhookUrl' in webhook
                            ? DiscordWebhookTransport.maskWebhookUrl(webhook.webhookUrl)
                            : undefined
                }
            }
        }
    )
}
