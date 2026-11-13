import { GLOBAL_TOPIC, gameTopic, userTopic } from '@tabletop/backend-services'
import type { User } from '@tabletop/common'
import { Type, type Static } from 'typebox'

export const RealtimeGameTopicsQuery = Type.Object({
    game: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 4 }))
})
export type RealtimeGameTopicsQuery = Static<typeof RealtimeGameTopicsQuery>

export function realtimeTopicsFor({
    user,
    gameIds = []
}: {
    user: Pick<User, 'id'>
    gameIds?: string[]
}): string[] {
    return [userTopic(user.id), GLOBAL_TOPIC, ...[...new Set(gameIds)].map(gameTopic)]
}
