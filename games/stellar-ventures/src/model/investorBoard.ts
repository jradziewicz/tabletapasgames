// The Investor Board (rulebook page 19, "Investor Shenanigans"): each player has their own,
// tracking one Action Disc per row - Investor Action and Alien Tech Action. Each Investor
// Round, a player's disc must move to a NEW action (different from whichever it's currently on)
// or be removed from the board entirely ("pass"). Confirmed by the game's co-designer: this
// restriction persists across Investor Rounds, not just within a single turn - see
// playerState.lastInvestorActionId / lastAlienTechActionId and
// operations/investorShenanigans.ts's canSelectInvestorActionId / canSelectAlienTechActionId.
// All discs start off the board (both fields undefined), making every action available the
// first time.
export enum InvestorActionId {
    PrivateContractor = 'privateContractor',
    JerryRig = 'jerryRig',
    InsuranceFraud = 'insuranceFraud',
    BlackMarket = 'blackMarket'
}

export enum AlienTechActionId {
    CargoBoost = 'cargoBoost',
    ResearchWormhole = 'researchWormhole',
    DevelopPlanets = 'developPlanets',
    Launder = 'launder'
}
