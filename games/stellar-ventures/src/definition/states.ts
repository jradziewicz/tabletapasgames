// The full set of machine states for Stellar Ventures. Handlers are added incrementally;
// see the game's task list for which states currently have a real handler implemented.
export enum MachineState {
    InitialAuction = 'InitialAuction',
    IssueShare = 'IssueShare',
    ExpandNetworkOrWormhole = 'ExpandNetworkOrWormhole',
    PayDividends = 'PayDividends',
    OrderShips = 'OrderShips',
    ReleaseDividends = 'ReleaseDividends',
    BoardroomBattle = 'BoardroomBattle',
    InvestorAction = 'InvestorAction',
    AlienTechAction = 'AlienTechAction',
    ScrapLowestShip = 'ScrapLowestShip',
    DeliverShips = 'DeliverShips',
    AssignTurnOrder = 'AssignTurnOrder',
    FormAmethystAgency = 'FormAmethystAgency',
    OfferSignTheAgreement = 'OfferSignTheAgreement',
    OfferSecretAgentsChoice = 'OfferSecretAgentsChoice',
    OfferTaxAgentsChoice = 'OfferTaxAgentsChoice',
    PayTaxes = 'PayTaxes',
    DraftPower = 'DraftPower',
    OfferSpareParts = 'OfferSpareParts',
    Liquidation = 'Liquidation',
    EndOfGame = 'EndOfGame'
}
