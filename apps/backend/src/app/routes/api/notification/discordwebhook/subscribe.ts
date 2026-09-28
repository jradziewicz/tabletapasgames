import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { DiscordWebhookTransport } from '@tabletop/backend-services'

type SubscribeDiscordWebhook = Static<typeof SubscribeDiscordWebhook>
const SubscribeDiscordWebhook = Type.Object(
    {
        webhookUrl: Type.String({ maxLength: 512 })
    },
    { additionalProperties: false }
)

// Saves (or replaces) the signed-in user's Discord webhook. A test message is posted to it
// first, so a bad/deleted webhook fails loudly here instead of silently never notifying.
export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SubscribeDiscordWebhook }>(
        '/subscribe',
        {
            schema: { body: SubscribeDiscordWebhook },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for subscribe request')
            }

            const subscription = DiscordWebhookTransport.subscriptionForUser(
                request.user.id,
                request.body.webhookUrl
            )
            await fastify.discordWebhookTransport.sendTestMessage(subscription.webhookUrl)

            // The store never overwrites an existing subscription's data, so swapping URLs is
            // an explicit remove-then-add of the user's single webhook document.
            await fastify.notificationService.unregisterNotificationSubscription(
                DiscordWebhookTransport.identifierForUser(request.user.id)
            )
            await fastify.notificationService.registerNotificationSubscription({
                topic: `user-${request.user.id}`,
                subscription
            })

            return {
                status: 'ok',
                payload: {
                    webhookUrl: DiscordWebhookTransport.maskWebhookUrl(subscription.webhookUrl)
                }
            }
        }
    )
}
