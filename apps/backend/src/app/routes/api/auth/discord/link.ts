import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { BaseError, ExternalAuthService } from '@tabletop/common'
import { URLSearchParams } from 'url'
import {
    RESTGetAPIOAuth2CurrentAuthorizationResult,
    RESTPostOAuth2AccessTokenResult
} from 'discord-api-types/v10'

type LinkRequest = Static<typeof LinkRequest>
const LinkRequest = Type.Object({
    code: Type.String()
})

const API_ENDPOINT = 'https://discord.com/api'

class DiscordLinkError extends BaseError {
    constructor(message: string) {
        super({ name: 'DiscordLinkError', message })
    }
}
const CLIENT_ID = process.env['DISCORD_CLIENT_ID'] || ''
const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''
const REDIRECT_URI = `${FRONTEND_HOST}/oauth/discord/link`

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LinkRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: LinkRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for link request')
            }

            const { code } = request.body
            const client_secret = await fastify.secretsService.getSecret('DISCORD_SECRET')

            const data = {
                client_id: CLIENT_ID,
                client_secret: client_secret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }

            const tokenResponse = await fetch(`${API_ENDPOINT}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(data)
            })

            const tokenData = (await tokenResponse.json().catch(() => undefined)) as
                | (RESTPostOAuth2AccessTokenResult & { error?: string; error_description?: string })
                | undefined
            if (!tokenResponse.ok || !tokenData?.access_token) {
                console.error(
                    'Discord token exchange failed',
                    tokenResponse.status,
                    tokenData?.error,
                    tokenData?.error_description
                )
                throw new DiscordLinkError(
                    `Discord did not accept the sign-in (${tokenData?.error_description ?? tokenData?.error ?? tokenResponse.status}). Please try linking again.`
                )
            }
            const accessToken = tokenData.access_token
            const userInfoResponse = await fetch(`${API_ENDPOINT}/oauth2/@me`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` }
            })

            const userInfoData =
                (await userInfoResponse.json()) as RESTGetAPIOAuth2CurrentAuthorizationResult
            if (!userInfoData || !userInfoData.user) {
                console.error('Discord returned no user info for link')
                throw new DiscordLinkError(
                    'Discord did not tell us who you are. Please try linking again.'
                )
            }

            const externalId = userInfoData.user.id

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
