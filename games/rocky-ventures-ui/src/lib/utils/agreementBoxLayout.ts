import { DeliveryCityId } from '@tabletop/rocky-ventures'

// Art-space (2000 x 1481) agreement boxes printed beside the delivery cities on the v0.50 board.
// The boxes are portrait; the landscape agreement cards sit in them rotated 90 degrees clockwise.
export interface AgreementBox {
    x: number
    y: number
    width: number
    height: number
}

export const AgreementBoxes: Record<DeliveryCityId, AgreementBox> = {
    [DeliveryCityId.Dornoch]: { x: 1497, y: 478, width: 63, height: 102 },
    [DeliveryCityId.Manor]: { x: 1497, y: 848, width: 63, height: 102 }
}
