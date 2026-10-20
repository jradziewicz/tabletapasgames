import { BaseError } from '@tabletop/common'

export class InvalidBugReportScreenshotError extends BaseError {
    constructor({ reason }: { reason: string }) {
        super({
            name: 'InvalidBugReportScreenshotError',
            message: `Bug report screenshot rejected: ${reason}`,
            metadata: { reason }
        })
    }
}
