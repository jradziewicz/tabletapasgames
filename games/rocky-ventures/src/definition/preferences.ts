import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

export const RockyVenturesPreferences = Type.Object(
    {
        workspaceLayout: Type.Unknown()
    },
    { additionalProperties: false }
)
export const RockyVenturesPreferenceDefinition = {
    title: {
        schema: RockyVenturesPreferences,
        defaults: { workspaceLayout: null },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof RockyVenturesPreferences>
