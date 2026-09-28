import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

// Per-player UI preferences for Stellar Ventures - currently just each player's own custom
// TabWorkspace layout (which panes exist, how they're split/sized, which tabs live where).
// Stored per account (so it follows a player between browsers on the same account) via the
// title preferences system; the workspace's own "close everything and re-add the tabs you want"
// controls remain the way to get back to a from-scratch layout.
export const StellarVenturesPreferences = Type.Object(
    {
        workspaceLayout: Type.Unknown()
    },
    { additionalProperties: false }
)
export const StellarVenturesPreferenceDefinition = {
    title: {
        schema: StellarVenturesPreferences,
        defaults: { workspaceLayout: null },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof StellarVenturesPreferences>
