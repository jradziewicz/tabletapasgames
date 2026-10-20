import { BaseError, BugReport, BugReportStatus } from '@tabletop/common'
import {
    CollectionReference,
    FieldValue,
    Firestore,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import { BugReportStore, StoredBugReportScreenshot } from '../stores/bugReportStore.js'
import { AlreadyExistsError, NotFoundError, UnknownStorageError } from '../stores/errors.js'
import { isFirestoreError } from './errors.js'

export class FirestoreBugReportStore implements BugReportStore {
    readonly bugReports: CollectionReference<BugReport>

    constructor(firestore: Firestore) {
        this.bugReports = firestore.collection('bugReports').withConverter(bugReportConverter)
    }

    // bugReports/{reportId}/screenshots/{n}: one document per image, the JPEG as a Bytes field.
    // Only the backend (Admin SDK) reads them; the admin screenshot route serves them.
    async createBugReport(
        report: BugReport,
        screenshots: readonly StoredBugReportScreenshot[] = []
    ): Promise<BugReport> {
        try {
            const doc = this.bugReports.doc(report.id)
            const batch = doc.firestore.batch()
            batch.create(doc, report)
            screenshots.forEach((screenshot, index) => {
                batch.create(this.screenshots(report.id).doc(String(index)), {
                    jpeg: screenshot.jpeg,
                    width: screenshot.width,
                    height: screenshot.height,
                    contentType: screenshot.contentType
                })
            })
            await batch.commit()
            return report
        } catch (error) {
            this.handleError(error, report.id)
            throw Error('unreachable')
        }
    }

    async findBugReportScreenshot({
        reportId,
        index
    }: {
        reportId: string
        index: number
    }): Promise<StoredBugReportScreenshot | undefined> {
        try {
            const snapshot = await this.screenshots(reportId).doc(String(index)).get()
            const data = snapshot.data()
            if (!data) {
                return undefined
            }
            return {
                jpeg: Buffer.from(data.jpeg as Uint8Array),
                width: data.width as number,
                height: data.height as number,
                contentType: 'image/jpeg'
            }
        } catch (error) {
            this.handleError(error, reportId)
            throw Error('unreachable')
        }
    }

    private screenshots(reportId: string) {
        return this.bugReports.doc(reportId).collection('screenshots')
    }

    // Filtering on status while ordering by createdAt uses the bugReports composite index.
    async findBugReports({
        status,
        limit
    }: {
        status?: BugReportStatus
        limit: number
    }): Promise<BugReport[]> {
        try {
            const query = status ? this.bugReports.where('status', '==', status) : this.bugReports
            const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get()
            return snapshot.docs.map((doc) => doc.data())
        } catch (error) {
            this.handleError(error, 'list')
            throw Error('unreachable')
        }
    }

    async setBugReportStatus({
        id,
        status,
        closedBy
    }: {
        id: string
        status: BugReportStatus
        closedBy?: string
    }): Promise<BugReport> {
        const doc = this.bugReports.doc(id)
        try {
            return await doc.firestore.runTransaction(async (transaction) => {
                const existing = (await transaction.get(doc)).data()
                if (!existing) {
                    throw new NotFoundError({ type: 'BugReport', id })
                }
                const closing = status === BugReportStatus.Closed
                const closedAt = new Date()
                transaction.update(doc, {
                    status,
                    closedAt: closing ? closedAt : FieldValue.delete(),
                    closedBy: closing && closedBy ? closedBy : FieldValue.delete()
                })
                const updated: BugReport = { ...existing, status }
                delete updated.closedAt
                delete updated.closedBy
                if (closing) {
                    updated.closedAt = closedAt
                    if (closedBy) updated.closedBy = closedBy
                }
                return updated
            })
        } catch (error) {
            this.handleError(error, id)
            throw Error('unreachable')
        }
    }

    private handleError(error: unknown, id: string) {
        if (error instanceof BaseError) {
            throw error
        } else if (isFirestoreError(error) && error.code === 6) {
            throw new AlreadyExistsError({
                type: 'BugReport',
                id,
                field: 'id',
                cause: error instanceof Error ? error : undefined
            })
        } else {
            throw new UnknownStorageError({
                type: 'BugReport',
                id,
                cause: error instanceof Error ? error : undefined
            })
        }
    }
}

const bugReportConverter = {
    toFirestore(report: BugReport): BugReport {
        return report
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): BugReport {
        const data = snapshot.data()
        const report = {
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate()
        } as BugReport
        if (data.closedAt) {
            report.closedAt = (data.closedAt as Timestamp).toDate()
        }
        return report
    }
}
