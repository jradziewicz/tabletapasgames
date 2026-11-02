import { FastifyInstance } from 'fastify'
import { BaseError, ExternalAuthService } from '@tabletop/common'
import {
    completeDiscordCallback,
    DiscordCallbackRequest
} from '../../../../lib/discordAuthorization.js'

class DiscordLinkError extends BaseError {
    constructor(message: string) {
        super({ name: 'DiscordLinkError', message })
    }
}

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DiscordCallbackRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: DiscordCallbackRequest },
            onRequest: fastify.auth([fastify.verifyUser, fastify.verifyRecentAuthentication], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for link request')
            }
            const identity = await completeDiscordCallback(fastify, request, 'link')
            const externalId = identity.externalId

            // Already linked to this very account: nothing to do, treat as success.
            if (request.user.externalIds?.includes(`${ExternalAuthService.Discord}:${externalId}`)) {
                return { status: 'ok', payload: { user: request.user } }
            }

            // Linked to someone else's account (e.g. an account created by signing in with
            // Discord): say so, rather than a bare 500 from the uniqueness constraint.
            const existing = await fastify.userService.getUserByExternalId(
                externalId,
                ExternalAuthService.Discord
            )
            if (existing && existing.id !== request.user.id) {
                throw new DiscordLinkError(
                    `That Discord account is already linked to a different TableTapas account (${existing.username}). Unlink it there first, or sign in to that account instead.`
                )
            }

            const updatedUser = await fastify.userService.linkExternalAccount({
                userId: request.user.id,
                externalId,
                service: ExternalAuthService.Discord
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
