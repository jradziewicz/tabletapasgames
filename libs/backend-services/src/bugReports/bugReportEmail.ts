import { Type, type Static } from 'typebox'

// What the bug report email to the site's moderation inbox shows. The full report, with its
// screenshots, stays on the Admin page's Bug reports tab.
export type BugReportEmail = Static<typeof BugReportEmail>
export const BugReportEmail = Type.Object(
    {
        toEmail: Type.String(),
        reportId: Type.String(),
        reportedAt: Type.String(),
        reporterName: Type.String(),
        gameName: Type.String(),
        titleName: Type.String(),
        seat: Type.Optional(Type.String()),
        description: Type.String(),
        screenshotCount: Type.Integer({ minimum: 0 }),
        gameUrl: Type.String(),
        adminUrl: Type.String()
    },
    { additionalProperties: false }
)

function escapeHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

export function bugReportEmailSubject(report: BugReportEmail): string {
    return `Bug report: ${report.titleName}, ${report.gameName}`
}

export function bugReportEmailText(report: BugReportEmail): string {
    return [
        `${report.reporterName} reported a bug in ${report.titleName} ("${report.gameName}")${report.seat ? `, playing as ${report.seat}` : ''}.`,
        '',
        report.description,
        '',
        `Screenshots: ${report.screenshotCount}`,
        `Reported: ${report.reportedAt}`,
        `Game: ${report.gameUrl}`,
        `All bug reports: ${report.adminUrl}`
    ].join('\n')
}

export function bugReportEmailHtml(report: BugReportEmail): string {
    const line = (label: string, value: string) =>
        `<p style="margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${value}</p>`
    return [
        '<div style="font-family:sans-serif;font-size:14px;line-height:1.5">',
        `<p>${escapeHtml(report.reporterName)} reported a bug in ${escapeHtml(report.titleName)} ("${escapeHtml(report.gameName)}")${report.seat ? `, playing as ${escapeHtml(report.seat)}` : ''}.</p>`,
        `<p style="white-space:pre-wrap;border-left:3px solid #7165ad;padding-left:12px">${escapeHtml(report.description)}</p>`,
        line('Screenshots', String(report.screenshotCount)),
        line('Reported', escapeHtml(report.reportedAt)),
        line('Game', `<a href="${escapeHtml(report.gameUrl)}">${escapeHtml(report.gameUrl)}</a>`),
        line(
            'All bug reports',
            `<a href="${escapeHtml(report.adminUrl)}">${escapeHtml(report.adminUrl)}</a>`
        ),
        '</div>'
    ].join('\n')
}
