import { BugReport, BugReportStatus } from '@tabletop/common'

/** One screenshot of a bug report, kept apart from the report so listing reports stays small. */
export type StoredBugReportScreenshot = {
    jpeg: Buffer
    width: number
    height: number
    contentType: 'image/jpeg'
}

export interface BugReportStore {
    /** Stores the report and its screenshots together; screenshot n is read back by index n. */
    createBugReport(
        report: BugReport,
        screenshots?: readonly StoredBugReportScreenshot[]
    ): Promise<BugReport>
    findBugReportScreenshot({
        reportId,
        index
    }: {
        reportId: string
        index: number
    }): Promise<StoredBugReportScreenshot | undefined>
    /** Newest first, optionally only those with the given status. */
    findBugReports({
        status,
        limit
    }: {
        status?: BugReportStatus
        limit: number
    }): Promise<BugReport[]>
    /** Closing records who closed it and when; reopening clears both. */
    setBugReportStatus({
        id,
        status,
        closedBy
    }: {
        id: string
        status: BugReportStatus
        closedBy?: string
    }): Promise<BugReport>
}
