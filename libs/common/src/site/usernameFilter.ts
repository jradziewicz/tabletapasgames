import * as Type from 'typebox'
import { BaseError } from '../util/errors.js'
import { DateType } from '../util/typebox.js'

// Usernames are public on every game, chat and leaderboard, so slurs and obvious profanity are
// refused at sign-up and on rename (see isInappropriateUsername). The check normalizes case,
// accents, common leetspeak (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s) and separators, so
// "N.1.g-g/e_r" is caught the same as the plain word.
//
// Two lists, to keep false positives down:
// - CONTAINED terms are long or unambiguous enough to block wherever they appear, even inside a
//   longer name ("xXfuckXx").
// - WHOLE_WORD terms are short or common inside innocent words (Cassandra, Dickens, peacock,
//   grape), so they only block as a whole word in the name: split on separators, digits and
//   camelCase, plus a plural "s"/"es".
// ALLOWED words are removed before the contained check (Scunthorpe, Penistone...).

const CONTAINED = [
    // Slurs
    'nigger',
    'nigga',
    'niggah',
    'faggot',
    'fagot',
    'retard',
    'tranny',
    'wetback',
    'beaner',
    'raghead',
    'towelhead',
    'shemale',
    // Hate
    'hitler',
    'heilhitler',
    'siegheil',
    'whitepower',
    'kkk',
    'gaschamber',
    // Profanity and sexual terms
    'fuck',
    'motherfucker',
    'cunt',
    'bullshit',
    'shithead',
    'shithole',
    'shitty',
    'dipshit',
    'bitch',
    'whore',
    'slut',
    'pussy',
    'penis',
    'vagina',
    'blowjob',
    'handjob',
    'rimjob',
    'cumshot',
    'jizz',
    'dildo',
    'porn',
    'pedophile',
    'paedophile',
    'rapist',
    'molest',
    'incest',
    'bestiality',
    'masturbat',
    'orgasm',
    'asshole',
    'bastard',
    'twat',
    'wanker',
    'bollocks',
    'testicle'
]

const WHOLE_WORD = [
    // Slurs
    'fag',
    'spic',
    'spick',
    'chink',
    'gook',
    'coon',
    'kike',
    'dyke',
    'paki',
    'jap',
    'nig',
    'sandnigger',
    // Hate
    'nazi',
    // Profanity and sexual terms
    'shit',
    'fuk',
    'ass',
    'arse',
    'dick',
    'cock',
    'cum',
    'tit',
    'tits',
    'rape',
    'sex',
    'anal',
    'clit',
    'semen',
    'boner',
    'pedo'
]

// Real words and places that contain a CONTAINED term. Removed before the contained check.
const ALLOWED = ['scunthorpe', 'penistone', 'therapist', 'retardant', 'shitake', 'shiitake']

const LEET: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '!': 'i',
    '|': 'i',
    '3': 'e',
    '4': 'a',
    '@': 'a',
    '5': 's',
    $: 's',
    '7': 't',
    '+': 't',
    '8': 'b',
    '9': 'g'
}

function stripAccents(value: string): string {
    return value.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

function deLeet(value: string): string {
    return [...value].map((char) => LEET[char] ?? char).join('')
}

// Letters only, after accents and leetspeak - "N.1.g-g/e_r" -> "nigger".
function squash(value: string): string {
    return deLeet(stripAccents(value).toLowerCase()).replace(/[^a-z]/g, '')
}

// "fuuuuck" -> "fuck": a letter stretched 3+ times for emphasis or to dodge the filter. Doubled
// letters are left alone so real words (and "nigger" vs. the country Niger) stay distinct.
function collapseRepeats(value: string): string {
    return value.replace(/(.)\1{2,}/g, '$1')
}

function words(value: string): string[] {
    return stripAccents(value)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9@$!|+]+|(?<=[A-Za-z])(?=[0-9]{2,})|(?<=[0-9])(?=[A-Za-z]{2,})/)
        .map((word) => squash(word))
        .filter((word) => word.length > 0)
}

function withoutAllowed(value: string): string {
    let result = value
    for (const allowed of ALLOWED) result = result.split(allowed).join('')
    return result
}

/**
 * Whether a username contains a slur, hate term or obvious profanity. Used both on the server
 * (sign-up and rename, which is what actually enforces it) and in the sign-up/profile forms for
 * instant feedback.
 */
export function isInappropriateUsername(username: string): boolean {
    const squashed = withoutAllowed(squash(username))
    const collapsed = collapseRepeats(squashed)
    if (CONTAINED.some((term) => squashed.includes(term) || collapsed.includes(term))) return true

    const nameWords = words(username)
    return nameWords.some((word) => {
        const singular = word.replace(/(es|s)$/, '')
        return (
            WHOLE_WORD.includes(word) ||
            WHOLE_WORD.includes(singular) ||
            WHOLE_WORD.includes(collapseRepeats(word))
        )
    })
}

export const INAPPROPRIATE_USERNAME_ERROR = 'InappropriateUsernameError'

export class InappropriateUsernameError extends BaseError {
    constructor() {
        super({
            name: INAPPROPRIATE_USERNAME_ERROR,
            message: 'That username is not allowed. Please choose another.'
        })
    }
}

// "Think this is a mistake? Let us know." - a blocked name sent to the admins. Approving it lets
// that exact name (any letter case) through the filter from then on.
export enum UsernameReviewStatus {
    Open = 'open',
    Approved = 'approved',
    Dismissed = 'dismissed'
}

export const USERNAME_REVIEW_NOTE_MAX_LENGTH = 500

export type UsernameReviewRequest = Type.Static<typeof UsernameReviewRequest>
export const UsernameReviewRequest = Type.Object(
    {
        username: Type.String({ minLength: 1, maxLength: 64 }),
        note: Type.Optional(Type.String({ maxLength: USERNAME_REVIEW_NOTE_MAX_LENGTH }))
    },
    { additionalProperties: false }
)

export type UsernameReview = Type.Static<typeof UsernameReview>
export const UsernameReview = Type.Object({
    id: Type.String(),
    username: Type.String(),
    note: Type.Optional(Type.String()),
    requesterId: Type.Optional(Type.String()),
    requesterEmail: Type.Optional(Type.String()),
    status: Type.Enum(UsernameReviewStatus),
    createdAt: DateType(),
    resolvedAt: Type.Optional(DateType())
})

export type UsernameReviewList = Type.Static<typeof UsernameReviewList>
export const UsernameReviewList = Type.Object({ reviews: Type.Array(UsernameReview) })

export type UsernameReviewStatusUpdate = Type.Static<typeof UsernameReviewStatusUpdate>
export const UsernameReviewStatusUpdate = Type.Object(
    { status: Type.Enum(UsernameReviewStatus) },
    { additionalProperties: false }
)
