import * as Type from 'typebox'

export const DummyPlayerId = 'dummy'
export const DummyPlayerCount = 2

export type DummyState = Type.Static<typeof DummyState>
export const DummyState = Type.Object({
    money: Type.Number(),
    victoryPoints: Type.Number(),
    weaponLevel: Type.Number(),
    toolLevel: Type.Number(),
    tuckedCardIds: Type.Array(Type.String()),
    nextAction: Type.Union([Type.Literal('tax'), Type.Literal('acquire')]),
    nextBump: Type.Union([Type.Literal('weapon'), Type.Literal('tool')]),
    lastAction: Type.Optional(Type.String()),
    won: Type.Optional(Type.Boolean())
})
