import * as Type from 'typebox'
import { DateType } from '../util/typebox.js'

export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 2000

export type BugReportView = Type.Static<typeof BugReportView>
export const BugReportView = Type.Object({
    actionCount: Type.Optional(Type.Integer({ minimum: 0 })),
    inHistory: Type.Boolean(),
    exploring: Type.Boolean()
})

export type BugReportVersions = Type.Static<typeof BugReportVersions>
export const BugReportVersions = Type.Object({
    site: Type.Optional(Type.String({ maxLength: 64 })),
    logic: Type.Optional(Type.String({ maxLength: 64 })),
    ui: Type.Optional(Type.String({ maxLength: 64 }))
})

export type BugReportClient = Type.Static<typeof BugReportClient>
export const BugReportClient = Type.Object({
    userAgent: Type.String({ maxLength: 512 }),
    viewport: Type.String({ maxLength: 64 }),
    installedApp: Type.Boolean()
})

/** What a player's browser sends when they report a bug from a game. */
export type BugReportRequest = Type.Static<typeof BugReportRequest>
export const BugReportRequest = Type.Object(
    {
        gameId: Type.String({ minLength: 1 }),
        description: Type.String({
            minLength: 1,
            maxLength: BUG_REPORT_DESCRIPTION_MAX_LENGTH
        }),
        view: BugReportView,
        versions: BugReportVersions,
        client: BugReportClient
    },
    { additionalProperties: false }
)

export enum BugReportStatus {
    Open = 'open',
    Closed = 'closed'
}

/** The game as the server saw it when the report was filed, next to what the browser sent. */
export type BugReportContext = Type.Static<typeof BugReportContext>
export const BugReportContext = Type.Object({
    seat: Type.Optional(Type.String()),
    gameStatus: Type.String(),
    liveActionCount: Type.Optional(Type.Integer({ minimum: 0 })),
    activePlayers: Type.Array(Type.String()),
    view: BugReportView,
    versions: BugReportVersions,
    client: BugReportClient
})

/** A stored bug report, read by site admins. */
export type BugReport = Type.Static<typeof BugReport>
export const BugReport = Type.Object({
    id: Type.String(),
    status: Type.Enum(BugReportStatus),
    reporterId: Type.String(),
    reporterName: Type.String(),
    gameId: Type.String(),
    gameName: Type.String(),
    titleId: Type.String(),
    titleName: Type.String(),
    description: Type.String(),
    context: BugReportContext,
    createdAt: DateType(),
    closedAt: Type.Optional(DateType()),
    closedBy: Type.Optional(Type.String())
})

export type BugReportList = Type.Static<typeof BugReportList>
export const BugReportList = Type.Object({ reports: Type.Array(BugReport) })

export type BugReportStatusUpdate = Type.Static<typeof BugReportStatusUpdate>
export const BugReportStatusUpdate = Type.Object(
    { status: Type.Enum(BugReportStatus) },
    { additionalProperties: false }
)

/** Where a bug report sits in the game's history, in words. */
export function bugReportViewLabel(view: BugReportView, liveActionCount?: number): string {
    if (view.exploring) {
        return 'Exploration'
    }
    if (view.inHistory) {
        return `History, after ${view.actionCount ?? '?'} of ${liveActionCount ?? '?'} actions`
    }
    return 'Live'
}

export function bugReportVersionsLabel(versions: BugReportVersions): string {
    return `Logic ${versions.logic ?? '?'} · UI ${versions.ui ?? '?'} · Site ${versions.site ?? '?'}`
}
