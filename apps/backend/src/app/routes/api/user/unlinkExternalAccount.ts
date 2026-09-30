import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'

type UnlinkExternalAccountRequest = Static<typeof UnlinkExternalAccountRequest>
const UnlinkExternalAccountRequest = Type.Object(
    {
        externalId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: UnlinkExternalAccountRequest }>(
        '/unlinkExternalAccount',
        {
            schema: { body: UnlinkExternalAccountRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { externalId } = request.body
            // Unlinking Discord also turns off bot DMs to that account - the subscription is
            // keyed by the Discord user id, so it would otherwise keep messaging a stranger's
            // (or a re-used) Discord account after the link is gone.
            if (externalId.trim().startsWith(`${ExternalAuthService.Discord}:`)) {
                await fastify.discordService.unsubscribe(request.user)
            }
            const updatedUser = await fastify.userService.unlinkExternalAccount({
                userId: request.user.id,
                externalId
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
