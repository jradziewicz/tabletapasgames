import * as Type from 'typebox'
import type { GameConfigOptions } from '@tabletop/common'

export type LocustGameConfig = Type.Static<typeof LocustGameConfig>
export const LocustGameConfig = Type.Object({})

export const LocustGameConfigOptions: GameConfigOptions = []
