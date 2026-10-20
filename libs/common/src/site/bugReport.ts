import * as Type from 'typebox'
import { DateType } from '../util/typebox.js'

export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 2000
export const BUG_REPORT_SCREENSHOT_MAX_COUNT = 3
// Each screenshot is stored as its own Firestore document, which holds at most 1 MiB.
export const BUG_REPORT_SCREENSHOT_MAX_BYTES = 700_000
export const BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH =
    Math.ceil(BUG_REPORT_SCREENSHOT_MAX_BYTES / 3) * 4
export const BUG_REPORT_SCREENSHOT_MAX_EDGE_PX = 4096

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

// Every JPEG starts with the bytes FF D8 FF, which base64 encodes as "/9j/".
const JPEG_START_IN_BASE64 = '/9j/'

/** A screenshot the player pasted, re-encoded as a JPEG by their browser. */
export type BugReportScreenshot = Type.Static<typeof BugReportScreenshot>
export const BugReportScreenshot = Type.Object(
    {
        jpeg: Type.String({
            maxLength: BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH,
            pattern: `^${JPEG_START_IN_BASE64}[A-Za-z0-9+/]*={0,2}$`
        }),
        width: Type.Integer({ minimum: 1, maximum: BUG_REPORT_SCREENSHOT_MAX_EDGE_PX }),
        height: Type.Integer({ minimum: 1, maximum: BUG_REPORT_SCREENSHOT_MAX_EDGE_PX })
    },
    { additionalProperties: false }
)

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
        client: BugReportClient,
        screenshots: Type.Optional(
            Type.Array(BugReportScreenshot, {
                minItems: 1,
                maxItems: BUG_REPORT_SCREENSHOT_MAX_COUNT
            })
        )
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
    /** Screenshots stored with the report; admins fetch each one by its index. */
    screenshotCount: Type.Optional(Type.Integer({ minimum: 0 })),
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
