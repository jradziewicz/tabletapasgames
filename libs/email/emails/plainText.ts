import { GameResult } from '@tabletop/common'
import { formatNames } from '../components/darkCard.js'
import { AccountChangeType } from './AccountChangeNotification.js'

// Plain-text parts for the HTML emails, sent alongside them for mail clients that show text
// only and for spam filters that prefer both. Written by hand rather than converted from the
// HTML: the conversion repeats the wordmark's link three times and keeps the preview padding.
// Keep the wording in step with the matching .tsx template.

const SIGNATURE = 'TableTapas Games\nhttps://play.tabletapasgames.com'

function plainTextEmail(heading: string, body: string[], footer: string): string {
    return [heading, '', ...body.flatMap((paragraph) => [paragraph, '']), '--', footer, '', SIGNATURE]
        .join('\n')
        .concat('\n')
}

export const emailVerificationText = ({
    token,
    expiresInMinutes = 15
}: {
    token: string
    expiresInMinutes?: number
}): string =>
    plainTextEmail(
        'Confirm your email address',
        [
            'Enter this code on the verification screen to finish signing in.',
            token,
            `This code stops working ${expiresInMinutes} minutes after it was requested, and only the most recent code works.`
        ],
        'If you did not request this, you can safely ignore this email.'
    )

export const passwordResetText = ({
    url,
    expiresInMinutes = 15
}: {
    url: string
    expiresInMinutes?: number
}): string =>
    plainTextEmail(
        'Reset your password',
        [
            `Open this link to choose a new password. The link stops working ${expiresInMinutes} minutes after it was requested, and only the most recent link works.`,
            url
        ],
        'If you did not request a password reset, you can safely ignore this email.'
    )

// The server runs in UTC and an email cannot know the reader's time zone, so say UTC outright.
const formatTimestamp = (timestamp: Date): string =>
    `${timestamp.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC`

const accountChanges: Record<string, string> = {
    [AccountChangeType.PasswordReset]: 'A request was made to reset the password for your account',
    [AccountChangeType.Email]: 'Your email address was changed',
    [AccountChangeType.Password]: 'Your password was changed'
}

export const accountChangeNotificationText = ({
    changeType,
    timestamp
}: {
    changeType: string
    timestamp: Date
}): string =>
    plainTextEmail(
        'Account change detected',
        [
            `${accountChanges[changeType] ?? 'Your account was changed'} on ${formatTimestamp(timestamp)}.`,
            'If you did not make this change, please contact us immediately.'
        ],
        'If you made the change described above, you can safely ignore this email.'
    )

export const gameInvitationText = ({
    ownerName,
    gameName,
    title,
    url
}: {
    ownerName: string
    gameName: string
    title: string
    url: string
}): string =>
    plainTextEmail(
        `${ownerName} invited you to play`,
        [
            'Accept the invite to join the table. Your seat is waiting.',
            `${gameName} (${title})`,
            `Join the game: ${url}`
        ],
        'If you did not expect this invite, you can safely ignore this email.'
    )

export const gameEndText = ({
    result,
    winners,
    gameName,
    title,
    url
}: {
    result: GameResult
    winners: string[]
    gameName: string
    title: string
    url: string
}): string => {
    const winnerNames = formatNames(winners, 'Someone')
    const resultText =
        result === GameResult.Draw
            ? `${winnerNames} tied.`
            : result === GameResult.Abandoned
              ? 'The game was abandoned.'
              : `${winnerNames} won!`
    return plainTextEmail(
        gameName,
        [`Your game of ${title} has ended.`, resultText, `Revisit the game: ${url}`],
        'You played in this game on TableTapas Games.'
    )
}

export const yourTurnText = ({
    title,
    gameName,
    url
}: {
    title: string
    gameName: string
    url: string
}): string =>
    plainTextEmail(
        "It's your move",
        [
            'The other players are waiting on you. Jump back in and keep the game moving.',
            `${gameName} (${title})`,
            `Take your turn: ${url}`
        ],
        "You're receiving this because it's your turn in an active game. You won't get another email for this turn unless it stays open for a while."
    )
