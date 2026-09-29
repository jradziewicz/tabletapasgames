import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { DiscordWebhookTransport, TransportType } from '@tabletop/backend-services'

type SetDiscordMention = Static<typeof SetDiscordMention>
const SetDiscordMention = Type.Object(
    {
        // Empty/missing clears the mention; otherwise a Discord user id (or pasted <@id>).
        discordUserId: Type.Optional(Type.String({ maxLength: 64 }))
    },
    { additionalProperties: false }
)

// Sets or clears the @mention on the user's existing webhook without making them paste the
// webhook URL again (the status endpoint only ever hands back a masked URL). Re-registers the
// single subscription document with the same URL, since the store never rewrites one in place.
export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SetDiscordMention }>(
        '/mention',
        {
            schema: { body: SetDiscordMention },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for mention request')
            }
            const subscriptions = await fastify.notificationService.findNotificationSubscriptions(
                `user-${request.user.id}`
            )
            const existing = subscriptions.find(
                (subscription) => subscription.transport === TransportType.DiscordWebhook
            )
            if (!existing || !('webhookUrl' in existing)) {
                return reply.code(400).send({
                    status: 'error',
                    error: {
                        name: 'NoDiscordWebhook',
                        message: 'Connect a Discord webhook first, then add your user ID.'
                    }
                })
            }

            const subscription = DiscordWebhookTransport.subscriptionForUser(
                request.user.id,
                existing.webhookUrl,
                request.body.discordUserId
            )
            if (subscription.discordUserId) {
                // Prove the ping works before saving it.
                await fastify.discordWebhookTransport.sendTestMessage(
                    subscription.webhookUrl,
                    subscription.discordUserId
                )
            }
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
                    webhookUrl: DiscordWebhookTransport.maskWebhookUrl(subscription.webhookUrl),
                    discordUserId: subscription.discordUserId
                }
            }
        }
    )
}
