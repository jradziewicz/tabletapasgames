import { BugReport, BugReportStatus } from '@tabletop/common'

export interface BugReportStore {
    createBugReport(report: BugReport): Promise<BugReport>
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
