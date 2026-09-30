import { CompanyId } from '@tabletop/rocky-ventures'

// Art-space (2000 x 1481) positions of the four company boards printed down the left edge of the
// v0.50 game board: the value-slot column and the delivery circle column of each.
export interface CompanyBoardLayout {
    slotX: number
    circleX: number
    bottomY: number
    slotSpacing: number
    circleSpacing: number
    dornochDurBoxX: number
    dornochDurBoxY: number
    shareBoxX: number
    shareBoxY: number
}

const TopRowBottomY = 706
const BottomRowBottomY = 1379
const SlotSpacing = 30.9
const CircleSpacing = 49.25

export const CompanyBoardLayouts: Record<CompanyId, CompanyBoardLayout> = {
    [CompanyId.WizardCannonball]: {
        shareBoxX: 96,
        slotX: 112,
        circleX: 165,
        bottomY: TopRowBottomY,
        slotSpacing: SlotSpacing,
        circleSpacing: CircleSpacing,
        dornochDurBoxX: 112,
        dornochDurBoxY: 186,
        shareBoxY: 84
    },
    [CompanyId.DwarvenPacific]: {
        shareBoxX: 222,
        slotX: 235,
        circleX: 288,
        bottomY: TopRowBottomY,
        slotSpacing: SlotSpacing,
        circleSpacing: CircleSpacing,
        dornochDurBoxX: 235,
        dornochDurBoxY: 186,
        shareBoxY: 84
    },
    [CompanyId.GoblinCentral]: {
        shareBoxX: 96,
        slotX: 112,
        circleX: 165,
        bottomY: BottomRowBottomY,
        slotSpacing: SlotSpacing,
        circleSpacing: CircleSpacing,
        dornochDurBoxX: 112,
        dornochDurBoxY: 863,
        shareBoxY: 761
    },
    [CompanyId.WingedWyrm]: {
        shareBoxX: 222,
        slotX: 235,
        circleX: 288,
        bottomY: BottomRowBottomY,
        slotSpacing: SlotSpacing,
        circleSpacing: CircleSpacing,
        dornochDurBoxX: 235,
        dornochDurBoxY: 863,
        shareBoxY: 761
    }
}
