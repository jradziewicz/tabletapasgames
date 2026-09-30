export interface ScourgeDefinition {
    id: string
    name: string
    level: number
}

// RV-v043b Scourge deck (15 cards; the draft rulebook says 16 - docs/rules-questions.md item 35).
// Listed in deck order: level 1 on top, level 4 on the bottom.
export const ScourgeDefinitions: ScourgeDefinition[] = [
    { id: 'rats', name: 'Rats', level: 1 },
    { id: 'imps', name: 'Imps', level: 1 },
    { id: 'giantSpider', name: 'Giant Spider', level: 1 },
    { id: 'goblins', name: 'Goblins', level: 1 },
    { id: 'serpent1', name: 'Serpent', level: 2 },
    { id: 'serpent2', name: 'Serpent', level: 2 },
    { id: 'werewolf', name: 'Werewolf', level: 2 },
    { id: 'mountainTroll', name: 'Mountain Troll', level: 2 },
    { id: 'ogre', name: 'Ogre', level: 2 },
    { id: 'forestTroll', name: 'Forest Troll', level: 3 },
    { id: 'ghost', name: 'Ghost', level: 3 },
    { id: 'manticore', name: 'Manticore', level: 3 },
    { id: 'hellhound', name: 'Hellhound', level: 3 },
    { id: 'succubus', name: 'Succubus', level: 3 },
    { id: 'demon', name: 'Demon', level: 4 }
]

export const ScourgeDefinitionsById: Record<string, ScourgeDefinition> = Object.fromEntries(
    ScourgeDefinitions.map((scourge) => [scourge.id, scourge])
)

export const DragonLevel = 8
export const DragonSecurityCost = 8
export const BonusTokensToSummonDragon = 6
