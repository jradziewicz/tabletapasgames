import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/all',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function () {
            const users = await fastify.userService.listUsers()
            return { status: 'ok', payload: { users } }
        }
    )
}
