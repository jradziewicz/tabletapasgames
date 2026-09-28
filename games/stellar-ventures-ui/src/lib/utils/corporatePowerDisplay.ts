import { CorporatePowerId } from '@tabletop/stellar-ventures'

// Short, UI-friendly summaries derived from the Corporate Power Glossary comments in
// model/corporation.ts (the logic package's source of truth for exact rules text). Only the 18
// Neutral powers are ever drafted through DraftPowerPanel.svelte - AlienExplorers and
// SecretAgents are Starting/Formation powers and never appear in availableCorporatePowerIds.
export const CorporatePowerDisplayNames: Record<string, string> = {
    [CorporatePowerId.AlienExplorers]: 'Alien Explorers',
    [CorporatePowerId.SecretAgents]: 'Secret Agents',
    [CorporatePowerId.TaxAgents]: 'Tax Agents',
    [CorporatePowerId.AccountingGimmick]: 'Accounting Gimmick',
    [CorporatePowerId.LeakedResearch]: 'Leaked Research',
    [CorporatePowerId.AlienEngineering]: 'Alien Engineering',
    [CorporatePowerId.CloakingDevices]: 'Cloaking Devices',
    [CorporatePowerId.DeepSpaceSmuggling]: 'Deep Space Smuggling',
    [CorporatePowerId.FinePrint]: 'Fine Print',
    [CorporatePowerId.IcarusExperiment]: 'Icarus Experiment',
    [CorporatePowerId.AlienAlchemist]: 'Alien Alchemist',
    [CorporatePowerId.BackroomDeal]: 'Backroom Deal',
    [CorporatePowerId.DeepSpacePirates]: 'Deep Space Pirates',
    [CorporatePowerId.DismantlingOutposts]: 'Dismantling Outposts',
    [CorporatePowerId.Hyperdrive]: 'Hyperdrive',
    [CorporatePowerId.StalledIPO]: 'Stalled IPO',
    [CorporatePowerId.SpareParts]: 'Spare Parts',
    [CorporatePowerId.OreRefinement]: 'Ore Refinement',
    [CorporatePowerId.QuantumPropulsion]: 'Quantum Propulsion',
    [CorporatePowerId.NebularExplorers]: 'Nebular Explorers',
    [CorporatePowerId.Windfall]: 'Windfall'
}

export const CorporatePowerDescriptions: Record<string, string> = {
    [CorporatePowerId.TaxAgents]:
        'May build on Alien Planets without gaining Alien Tech. After building on one, either make the other Corporations there pay their Tax, or take ₮3 from the Tax Box. May not Sign The Agreement.',
    [CorporatePowerId.AccountingGimmick]:
        "Liquidation: appears to have +5 Mining Capacity when checking for Hostile Takeover (doesn't change actual Share Value).",
    [CorporatePowerId.LeakedResearch]: 'One-Time: Research Wormhole as a free action (still spends Alien Tech).',
    [CorporatePowerId.AlienEngineering]:
        'Investor Round, Ongoing: reclaim Alien Tech Cubes from the Charter as a free action, losing the CARGO/Wormhole they granted.',
    [CorporatePowerId.CloakingDevices]:
        'Ongoing: build Outposts on Deep Space hexes ignoring Outpost Restrictions and Placement Penalties.',
    [CorporatePowerId.DeepSpaceSmuggling]: "One-Time: copy another Corporation's CARGO for Pay Dividends.",
    [CorporatePowerId.FinePrint]:
        'One-Time: discard before Boardroom Battle to exempt this Corporation from Votes and forced Share issuance.',
    [CorporatePowerId.IcarusExperiment]: 'Ongoing: may build Outposts on Suns and Anomalies.',
    [CorporatePowerId.AlienAlchemist]:
        'Once per Corporation Round: scrap 2 unbuilt Outposts for 1 Alien Tech Cube.',
    [CorporatePowerId.BackroomDeal]:
        "One-Time, before Liquidation's Hostile Takeover check: move the Alien Mining Capacity ±3.",
    [CorporatePowerId.DeepSpacePirates]: "One-Time: copy another Corporation's Mining Capacity for Pay Dividends.",
    [CorporatePowerId.DismantlingOutposts]:
        'Once per Corporation Round: return 1 Deep Space Outpost to the supply for ₮1, rebuildable immediately.',
    [CorporatePowerId.Hyperdrive]: 'Immediately: +1 CARGO (one-time, stays on Charter).',
    [CorporatePowerId.StalledIPO]: 'Ongoing: becomes a Major Corporation on its 5th Share instead of its 4th.',
    [CorporatePowerId.SpareParts]:
        'One-Time (limit 1 Ship): rescue a Ship that would be Scrapped, delaying it one Dividend payment.',
    [CorporatePowerId.OreRefinement]: 'Permanent: +3 Mining Capacity.',
    [CorporatePowerId.QuantumPropulsion]: 'Corporation Round: ₮2 discount on Create Wormhole.',
    [CorporatePowerId.NebularExplorers]:
        'One-Time: build an Outpost on a Nebular Anomaly, revealing it as a new Alien Planet.',
    [CorporatePowerId.Windfall]: 'Immediately receive ₮5 to the Treasury, then discard.'
}
