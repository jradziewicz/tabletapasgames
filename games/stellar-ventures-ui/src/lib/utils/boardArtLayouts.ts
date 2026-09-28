import type { BoundingBox, Point } from '@tabletop/common'
import { BoardMap } from '@tabletop/stellar-ventures'
import boardAlphaArt from '$lib/images/boardAlpha.jpg'
import boardBordersTaxesArt from '$lib/images/boardBordersTaxes.jpg'

export interface PrintedBoardPanels {
    turnOrderRowCentersPx: Point[]
    turnOrderMarkerSizePx: number
    taxBadgeCentersPxByBorderLevel: Record<number, Point>
    taxBoxCenterPx: Point
    // The printed "LOANS" reference card's own footprint - outpost markers for corporations
    // with an outstanding Loan are drawn as a 3-wide, 2-row grid centered on this box (see
    // Board.svelte's loanCorporations rendering), rather than a single row, so up to all 6
    // Corporations fit without the (double-sized, per the co-designer's own request) icons
    // overlapping - deliberately drawn on top of the card's own printed rules text, which is
    // fine to obscure once a Corporation actually needs a Loan.
    loansBoxCenterPx: Point
    loansColumnSpacingPx: number
    loansRowGapPx: number
}

export interface BoardArtLayout {
    art: string
    pixelsPerQ: number
    originPx: Point
    imageSizePx: { width: number; height: number }
    megaEarthBoxCentersPx: Point[]
    miniEarthBoxCentersPx: Point[]
    printedPanels?: PrintedBoardPanels
}

// Pixel positions are measured directly off each board's art file.
export const BoardArtLayouts: Record<BoardMap, BoardArtLayout> = {
    [BoardMap.Alpha]: {
        art: boardAlphaArt,
        pixelsPerQ: 186.5,
        originPx: { x: 247.5, y: 190 },
        imageSizePx: { width: 3642, height: 2000 },
        megaEarthBoxCentersPx: [
            { x: 3138, y: 1658.5 },
            { x: 3138, y: 1595 },
            { x: 3138, y: 1529 },
            { x: 3138, y: 1463.5 }
        ],
        miniEarthBoxCentersPx: []
    },
    [BoardMap.BordersAndTaxes]: {
        art: boardBordersTaxesArt,
        pixelsPerQ: 186.5,
        originPx: { x: 172, y: 130 },
        imageSizePx: { width: 3636, height: 1890 },
        megaEarthBoxCentersPx: [
            { x: 1105, y: 793 },
            { x: 1105, y: 726 },
            { x: 1105, y: 659 },
            { x: 1105, y: 591 }
        ],
        miniEarthBoxCentersPx: [
            { x: 732, y: 1770 },
            { x: 732, y: 1702 }
        ],
        printedPanels: {
            turnOrderRowCentersPx: [146, 226, 305, 384, 463, 539].map((y) => ({ x: 124, y })),
            turnOrderMarkerSizePx: 62,
            taxBadgeCentersPxByBorderLevel: {
                3: { x: 130, y: 795 },
                2: { x: 268, y: 795 },
                1: { x: 408, y: 795 }
            },
            taxBoxCenterPx: { x: 250, y: 1100 },
            loansBoxCenterPx: { x: 222, y: 1445 },
            loansColumnSpacingPx: 130,
            loansRowGapPx: 180
        }
    }
}

export function artBoundingBox(layout: BoardArtLayout, artScale: number): BoundingBox {
    return {
        x: -layout.originPx.x / artScale,
        y: -layout.originPx.y / artScale,
        width: layout.imageSizePx.width / artScale,
        height: layout.imageSizePx.height / artScale
    }
}
