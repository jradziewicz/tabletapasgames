import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type LiveSelectionRequest = Static<typeof LiveSelectionRequest>
const LiveSelectionRequest = Type.Object(
    {
        gameId: Type.String(),
        selection: Type.Record(Type.String(), Type.Unknown())
    },
    { additionalProperties: false }
)

// Relays a player's unconfirmed selection to the others in a Live play game. Nothing is stored.
export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LiveSelectionRequest }>(
        '/liveSelection',
        {
            bodyLimit: 4096,
            schema: { body: LiveSelectionRequest },
            config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for live selection')
            }
            await fastify.gameService.relayLiveSelection({
                user: request.user,
                gameId: request.body.gameId,
                selection: request.body.selection
            })
            await reply.code(204).send()
        }
    )
}
