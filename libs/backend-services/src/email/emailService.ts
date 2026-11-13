import { type AccountChangeType, Game, GameDefinition, User } from '@tabletop/common'

export { AccountChangeType } from '@tabletop/common'
import type { ContentReportEmail } from '../moderation/contentReports.js'

export interface EmailService {
    sendVerificationEmail(token: string, toEmail: string): Promise<void>
    sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void>
    sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string
    ): Promise<void>
    sendGameInvitationEmail({
        owner,
        game,
        definition,
        url,
        toEmail
    }: {
        owner: User
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void>
    sendContentReportEmail(report: ContentReportEmail): Promise<void>
    sendGameEndEmail({
        winners,
        game,
        definition,
        url,
        toEmail
    }: {
        winners: User[]
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void>
    sendTurnNotificationEmail({
        title,
        gameName,
        url,
        toEmail
    }: {
        title: string
        gameName: string
        url: string
        toEmail: string
    }): Promise<void>
}
