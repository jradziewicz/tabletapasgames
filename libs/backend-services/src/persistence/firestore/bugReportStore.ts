import { BaseError, BugReport, BugReportStatus } from '@tabletop/common'
import {
    CollectionReference,
    FieldValue,
    Firestore,
    QueryDocumentSnapshot,
    Timestamp
} from '@google-cloud/firestore'
import { BugReportStore } from '../stores/bugReportStore.js'
import { AlreadyExistsError, NotFoundError, UnknownStorageError } from '../stores/errors.js'
import { isFirestoreError } from './errors.js'

export class FirestoreBugReportStore implements BugReportStore {
    readonly bugReports: CollectionReference<BugReport>

    constructor(firestore: Firestore) {
        this.bugReports = firestore.collection('bugReports').withConverter(bugReportConverter)
    }

    async createBugReport(report: BugReport): Promise<BugReport> {
        try {
            await this.bugReports.doc(report.id).create(report)
            return report
        } catch (error) {
            this.handleError(error, report.id)
            throw Error('unreachable')
        }
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
