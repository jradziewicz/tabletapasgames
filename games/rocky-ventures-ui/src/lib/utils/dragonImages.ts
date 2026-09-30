import { WeaponTokenKind } from '@tabletop/rocky-ventures'

const dragonImageModules = import.meta.glob<string>('$lib/images/dragon/*.png', {
    eager: true,
    query: '?url',
    import: 'default'
})

const dragonImagesByName: Record<string, string> = Object.fromEntries(
    Object.entries(dragonImageModules).map(([path, url]) => [
        path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, ''),
        url
    ])
)

export const DragonTrackerImageUrl = dragonImagesByName['tracker']
export const DragonTileImageUrl = dragonImagesByName['dragon']

export function weaponTokenImageUrl(kind: WeaponTokenKind): string | undefined {
    return dragonImagesByName[kind]
}

// Where the six dragon-head slots sit on tracker.png (551 x 633).
export const DragonTrackerSize = { width: 551, height: 633 }
export const DragonTrackerSlots = [
    { x: 273, y: 147 },
    { x: 426, y: 235 },
    { x: 421, y: 402 },
    { x: 278, y: 489 },
    { x: 124, y: 399 },
    { x: 130, y: 230 }
]
