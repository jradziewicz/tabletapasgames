import * as Type from 'typebox'

export enum StatKind {
    Action = 'action',
    Purchase = 'purchase',
    Cash = 'cash',
    VictoryPoints = 'vp',
    GemGain = 'gemGain',
    GemSpend = 'gemSpend',
    MineClaim = 'mineClaim',
    MineExtract = 'mineExtract',
    Track = 'track'
}

export type StatEvent = Type.Static<typeof StatEvent>
export const StatEvent = Type.Object({
    kind: Type.Enum(StatKind),
    playerId: Type.String(),
    amount: Type.Number(),
    source: Type.Optional(Type.String()),
    cardId: Type.Optional(Type.String()),
    agreement: Type.Optional(Type.String()),
    nodeId: Type.Optional(Type.String()),
    detail: Type.Optional(Type.String()),
    copy: Type.Optional(Type.Boolean()),
    era: Type.Number(),
    action: Type.Number()
})
