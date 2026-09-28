import * as Type from 'typebox'
import { GameStatusCategory, Game } from '../game/model/game.js'

// Lists every Game across every user, for the Admin-only "all games" view - unlike
// GameHistoryQuery/Page (site/gameHistory.ts), which are always scoped to the requesting
// user's own games. Deliberately mirrors that same shape (a required category plus an
// opaque cursor string) so the two paginate the same way.
export const AdminGamesQuery = Type.Object(
    {
        category: Type.Optional(Type.Enum(GameStatusCategory)),
        before: Type.Optional(Type.String({ minLength: 1, maxLength: 512 }))
    },
    { additionalProperties: false }
)
export type AdminGamesQuery = Type.Static<typeof AdminGamesQuery>

// Plain Game (not the additionalProperties:false GameWithoutState), exactly like
// GameHistoryPage: stored games carry storage-only fields (actionChunkSize, userIds, ...)
// that a strict schema would reject client-side.
export const AdminGamesPage = Type.Object({
    games: Type.Array(Game),
    nextCursor: Type.Optional(Type.String())
})
export type AdminGamesPage = Type.Static<typeof AdminGamesPage>

export const AdminGamesCursor = Type.Object(
    {
        time: Type.Integer({ minimum: 0 }),
        id: Type.String({ minLength: 1, maxLength: 256, pattern: '^[^/]+$' })
    },
    { additionalProperties: false }
)
export type AdminGamesCursor = Type.Static<typeof AdminGamesCursor>
