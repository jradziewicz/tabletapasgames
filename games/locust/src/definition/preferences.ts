import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const LocustPreferences = Type.Object(
    {
        workspaceLayout: Type.Unknown()
    },
    { additionalProperties: false }
)
export const LocustPreferenceDefinition = {
    title: {
        schema: LocustPreferences,
        defaults: { workspaceLayout: null },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof LocustPreferences>
