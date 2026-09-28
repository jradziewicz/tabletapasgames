import type { FastifyInstance } from 'fastify'
import {
    AdminGamesCursor,
    AdminGamesQuery,
    GameStatusCategory,
    assertExists
} from '@tabletop/common'
import * as Value from 'typebox/value'

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: AdminGamesQuery }>(
        '/games',
        {
            schema: { querystring: AdminGamesQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async (request, reply) => {
            assertExists(request.user)
            const category = request.query.category ?? GameStatusCategory.Active

            let before: AdminGamesCursor | undefined
            if (request.query.before) {
                try {
                    const value: unknown = JSON.parse(request.query.before)
                    Value.Assert(AdminGamesCursor, value)
                    if (value.time > Date.now()) throw new Error('Future cursor')
                    before = value
                } catch {
                    return reply.code(400).send({
                        status: 'error',
                        error: { name: 'InvalidCursor', message: 'Invalid admin games cursor' }
                    })
                }
            }

            return {
                status: 'ok',
                payload: await fastify.gameService.getAllGamesForAdmin(category, before)
            }
        }
    )
}
