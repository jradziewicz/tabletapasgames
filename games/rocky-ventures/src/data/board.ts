import { BoxLayouts } from './boxLayout.js'
import { RegionId } from './regions.js'
import { CompanyId } from './companies.js'

// Transcribed from the v0.50 game board (games/rocky-ventures/docs/component-data.md).
// Coordinates are in the 2000 x 1481 art space of docs/source-assets/board-v050.jpg.

export const BoardArtSize = { width: 2000, height: 1481 }

export enum NodeKind {
    MineA = 'mineA',
    MineB = 'mineB',
    DeliveryCity = 'deliveryCity',
    Junction = 'junction'
}

export enum DeliveryCityId {
    Dornoch = 'dornoch',
    Manor = 'manor'
}

export interface BoardNode {
    id: string
    name: string
    kind: NodeKind
    region: RegionId
    x: number
    y: number
}

export enum BoxKind {
    Track = 'track',
    Water = 'water',
    Start = 'start'
}

export interface BoardBox {
    id: string
    kind: BoxKind
    cost: number
    startingCompanyId?: CompanyId
    dornochDurConnection?: boolean
    // Art-space position when the printed box does not sit at the edge's even spacing.
    x?: number
    y?: number
}

export interface BoardEdge {
    id: string
    from: string
    to: string
    boxes: BoardBox[]
}

const mineA = (id: string, name: string, region: RegionId, x: number, y: number): BoardNode => ({
    id,
    name,
    kind: NodeKind.MineA,
    region,
    x,
    y
})
const mineB = (id: string, name: string, region: RegionId, x: number, y: number): BoardNode => ({
    id,
    name,
    kind: NodeKind.MineB,
    region,
    x,
    y
})
const junction = (
    id: string,
    name: string,
    region: RegionId,
    x: number,
    y: number
): BoardNode => ({ id, name, kind: NodeKind.Junction, region, x, y })

export const DornochDurNodeId = 'dornochDur'

export const BoardNodes: BoardNode[] = [
    { id: DeliveryCityId.Dornoch, name: 'Dornoch', kind: NodeKind.DeliveryCity, region: RegionId.GoldValley, x: 1410, y: 446 },
    { id: DeliveryCityId.Manor, name: 'Manor', kind: NodeKind.DeliveryCity, region: RegionId.ManorsGate, x: 1275, y: 1035 },

    mineA('leuchars', 'Leuchars', RegionId.GoldValley, 1436, 302),
    mineA('graitney', 'Graitney', RegionId.GoldValley, 1494, 736),
    mineA('kiltarlity', 'Kiltarlity', RegionId.GoldValley, 1166, 496),
    mineA('laggan', 'Laggan', RegionId.GoldValley, 1108, 342),
    mineA('merton', 'Merton', RegionId.GoldValley, 1210, 262),

    mineA('northmavine', 'Northmavine', RegionId.IronsEnd, 1060, 204),
    mineA('irongray', 'Irongray', RegionId.IronsEnd, 1000, 454),
    mineA('findogask', 'Findogask', RegionId.IronsEnd, 798, 452),
    mineA('tainsPeak', "Tain's Peak", RegionId.IronsEnd, 1012, 772),
    mineA('glenshiel', 'Glenshiel', RegionId.IronsEnd, 870, 664),

    mineA('arbroath', 'Arbroath', RegionId.ManorsGate, 1190, 862),
    mineA('auchterarder', 'Auchterarder', RegionId.ManorsGate, 1366, 826),
    mineA('minnigaff', 'Minnigaff', RegionId.ManorsGate, 1442, 1298),

    mineA('lochranza', 'Lochranza', RegionId.Riverwood, 1064, 952),
    mineA('kirkoswald', 'Kirkoswald', RegionId.Riverwood, 1030, 1136),
    mineA('enzie', 'Enzie', RegionId.Riverwood, 1142, 1342),
    mineA('glenmoriston', 'Glenmoriston', RegionId.Riverwood, 770, 936),

    mineB('lintrathen', 'Lintrathen', RegionId.Riverwood, 708, 1118),
    mineB('fowlisEaster', 'Fowlis-Easter', RegionId.Riverwood, 676, 1340),
    mineB('urquhart', 'Urquhart', RegionId.Riverwood, 638, 842),

    mineB('drumelzier', 'Drumelzier', RegionId.TheSpine, 686, 286),
    mineB('hoyGraemsay', 'Hoy & Graemsay', RegionId.TheSpine, 478, 414),
    mineB('monquhitter', 'Monquhitter', RegionId.TheSpine, 514, 242),
    mineB('kirriemuir', 'Kirriemuir', RegionId.TheSpine, 426, 584),
    mineB(DornochDurNodeId, 'Dornoch-Dur', RegionId.TheSpine, 580, 684),

    mineB('lochwinnoch', 'Lochwinnoch', RegionId.Southport, 564, 926),
    mineB('glenisla', 'Glenisla', RegionId.Southport, 492, 802),
    mineB('westKilbride', 'West Kilbride', RegionId.Southport, 412, 1086),
    mineB('eastKilbride', 'East Kilbride', RegionId.Southport, 538, 1050),
    mineB('lochgoilhead', 'Lochgoilhead', RegionId.Southport, 418, 1302),

    junction('lyckheim', 'Lyckheim', RegionId.TheSpine, 545, 326),
    junction('tak', 'Tak', RegionId.TheSpine, 703, 390),
    junction('wamphray', 'Wamphray', RegionId.TheSpine, 676, 525),
    junction('strathfillan', 'Strathfillan', RegionId.TheSpine, 414, 721),
    junction('rutherglen', 'Rutherglen', RegionId.IronsEnd, 904, 320),
    junction('baenatorp', 'Baenatorp', RegionId.IronsEnd, 815, 570),
    junction('westray', 'Westray', RegionId.IronsEnd, 735, 698),
    junction('tain', 'Tain', RegionId.IronsEnd, 913, 818),
    junction('vetholm', 'Vetholm', RegionId.GoldValley, 1067, 608),
    junction('oldMeldrum', 'Old Meldrum', RegionId.GoldValley, 1291, 597),
    junction('balfron', 'Balfron', RegionId.GoldValley, 1332, 705),
    junction('orphir', 'Orphir', RegionId.GoldValley, 1293, 367),
    junction('northBute', 'North Bute', RegionId.GoldValley, 1307, 256),
    junction('avoch', 'Avoch', RegionId.ManorsGate, 1397, 917),
    junction('carnwath', 'Carnwath', RegionId.ManorsGate, 1462, 1150),
    junction('kills', 'Kills', RegionId.ManorsGate, 1171, 969),
    junction('drymen', 'Drymen', RegionId.ManorsGate, 1365, 1204),
    junction('croick', 'Croick', RegionId.ManorsGate, 1289, 1271),
    junction('rathven', 'Rathven', RegionId.Riverwood, 679, 987),
    junction('rothesay', 'Rothesay', RegionId.Riverwood, 880, 995),
    junction('polwarth', 'Polwarth', RegionId.Riverwood, 871, 1229),
    junction('halkirk', 'Halkirk', RegionId.Riverwood, 1078, 1251),
    junction('muirkirk', 'Muirkirk', RegionId.Southport, 588, 1220),
    junction('bratton', 'Brattön', RegionId.Southport, 530, 1382)
]

export const BoardNodesById: Record<string, BoardNode> = Object.fromEntries(
    BoardNodes.map((node) => [node.id, node])
)

type BoxSpec =
    | number
    | { water: number }
    | { start: CompanyId; x: number; y: number }
    | { dornochDur: number }

const edge = (from: string, to: string, ...specs: BoxSpec[]): BoardEdge => {
    const id = `${from}-${to}`
    return {
        id,
        from,
        to,
        boxes: specs.map((spec, index): BoardBox => {
            const boxId = `${id}#${index}`
            if (typeof spec === 'number') {
                return { id: boxId, kind: BoxKind.Track, cost: spec }
            }
            if ('water' in spec) {
                return { id: boxId, kind: BoxKind.Water, cost: spec.water }
            }
            if ('start' in spec) {
                return {
                    id: boxId,
                    kind: BoxKind.Start,
                    cost: 0,
                    startingCompanyId: spec.start,
                    x: spec.x,
                    y: spec.y
                }
            }
            return { id: boxId, kind: BoxKind.Track, cost: spec.dornochDur, dornochDurConnection: true }
        })
    }
}

export const BoardEdges: BoardEdge[] = [
    edge('monquhitter', 'drumelzier', 5),
    edge('monquhitter', 'lyckheim', 2),
    edge('lyckheim', 'hoyGraemsay', 2),
    edge('hoyGraemsay', 'drumelzier', 4),
    edge('hoyGraemsay', 'kirriemuir', 4),
    edge('drumelzier', 'tak', 3),
    edge('tak', 'wamphray', 3),
    edge('drumelzier', 'rutherglen', 3),
    edge('rutherglen', 'laggan', 3),
    edge('rutherglen', 'findogask', 3),
    edge('rutherglen', 'irongray', 3),
    edge('findogask', 'wamphray', 4),
    edge('findogask', 'baenatorp', 2),
    edge('baenatorp', 'glenshiel', 3),
    edge('kirriemuir', 'wamphray', 4),
    edge('kirriemuir', DornochDurNodeId, { dornochDur: 6 }),
    edge('kirriemuir', 'strathfillan', 3),
    edge('strathfillan', DornochDurNodeId, { dornochDur: 1 }),
    edge('strathfillan', 'glenisla', 2),
    edge('wamphray', 'westray', 4),
    edge('westray', 'tain', 2),
    edge('westray', 'urquhart', 2),
    edge('glenshiel', 'irongray', 5),
    edge('glenshiel', 'tain', 5),
    edge('tain', 'tainsPeak', 2),
    edge('tain', 'lochranza', 3),
    edge('tainsPeak', 'vetholm', 3),
    edge('tainsPeak', 'balfron', 2, 3),
    edge('vetholm', 'kiltarlity', 3),
    edge('vetholm', 'oldMeldrum', 3),
    edge('irongray', 'kiltarlity', 3),
    edge('northmavine', 'laggan', 4),
    edge('northmavine', 'merton', 5),
    edge('laggan', 'orphir', 4),
    edge('orphir', DeliveryCityId.Dornoch, { start: CompanyId.WizardCannonball, x: 1355, y: 407 }),
    edge('merton', 'northBute', 3),
    edge('northBute', 'leuchars', 3),
    edge('leuchars', DeliveryCityId.Dornoch, 2),
    edge('kiltarlity', DeliveryCityId.Dornoch, 4),
    edge(DeliveryCityId.Dornoch, 'oldMeldrum', { start: CompanyId.DwarvenPacific, x: 1332, y: 539 }),
    edge(DeliveryCityId.Dornoch, 'graitney', 4),
    edge('oldMeldrum', 'balfron', 3),
    edge('oldMeldrum', 'graitney', 3),
    edge('balfron', 'graitney', 2),
    edge('balfron', 'auchterarder', 2),
    edge('balfron', 'arbroath', 3),
    edge('graitney', 'avoch', 4),
    edge('auchterarder', 'arbroath', 4),
    edge('auchterarder', 'avoch', 3),
    edge('avoch', DeliveryCityId.Manor, { start: CompanyId.GoblinCentral, x: 1338, y: 972 }),
    edge('avoch', 'carnwath', 2, 2),
    edge(DeliveryCityId.Manor, 'carnwath', 5),
    edge(DeliveryCityId.Manor, 'kills', 2),
    edge(DeliveryCityId.Manor, 'drymen', { start: CompanyId.WingedWyrm, x: 1320, y: 1123 }),
    edge('arbroath', 'manor', 3),
    edge('arbroath', 'kills', 2),
    edge('arbroath', 'lochranza', 3),
    edge('lochranza', 'kills', 2),
    edge('glenmoriston', 'lochranza', 2, 2),
    edge('glenmoriston', 'urquhart', 4),
    edge('urquhart', 'glenisla', 3),
    edge('urquhart', 'lochwinnoch', 2),
    edge('lochwinnoch', 'rathven', 3),
    edge('rathven', 'eastKilbride', 3),
    edge('rathven', 'lintrathen', 2),
    edge('rothesay', 'lochranza', 3),
    edge('rothesay', 'lintrathen', 3),
    edge('rothesay', 'kirkoswald', 4),
    edge('polwarth', 'kirkoswald', 3),
    edge('lintrathen', 'polwarth', 3),
    edge('lintrathen', 'fowlisEaster', 3),
    edge('lintrathen', 'eastKilbride', 4),
    edge('eastKilbride', 'westKilbride', 2),
    edge('eastKilbride', 'muirkirk', 2),
    edge('westKilbride', 'lochgoilhead', { water: 3 }),
    edge('lochgoilhead', 'muirkirk', { water: 3 }),
    edge('lochgoilhead', 'bratton', { water: 3 }),
    edge('bratton', 'fowlisEaster', { water: 2 }),
    edge('fowlisEaster', 'polwarth', 3),
    edge('polwarth', 'halkirk', 4),
    edge('halkirk', 'enzie', 2),
    edge('kirkoswald', 'drymen', 6),
    edge('drymen', 'croick', 2),
    edge('croick', 'enzie', 2),
    edge('drymen', 'minnigaff', 2),
    edge('carnwath', 'minnigaff', 3)
]

export const BoardEdgesById: Record<string, BoardEdge> = Object.fromEntries(
    BoardEdges.map((boardEdge) => [boardEdge.id, boardEdge])
)

export interface BoxLocation {
    box: BoardBox
    edge: BoardEdge
    x: number
    y: number
    angle: number
}

export const BoardBoxLocations: BoxLocation[] = BoardEdges.flatMap((boardEdge) => {
    const from = BoardNodesById[boardEdge.from]
    const to = BoardNodesById[boardEdge.to]
    const count = boardEdge.boxes.length
    return boardEdge.boxes.map((box, index) => {
        const fraction = (index + 1) / (count + 1)
        const layout = BoxLayouts[box.id]
        const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
        return {
            box,
            edge: boardEdge,
            x: layout?.x ?? box.x ?? from.x + (to.x - from.x) * fraction,
            y: layout?.y ?? box.y ?? from.y + (to.y - from.y) * fraction,
            angle: layout?.angle ?? angle
        }
    })
})

export const BoardBoxesById: Record<string, BoardBox> = Object.fromEntries(
    BoardEdges.flatMap((boardEdge) => boardEdge.boxes.map((box) => [box.id, box]))
)

export const MineNodeIds: string[] = BoardNodes.filter(
    (node) => node.kind === NodeKind.MineA || node.kind === NodeKind.MineB
).map((node) => node.id)

export function isMineNode(node: BoardNode): boolean {
    return node.kind === NodeKind.MineA || node.kind === NodeKind.MineB
}
