import type { User } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import type { TaskService } from '../tasks/taskService.js'
import { nextReminderHour } from './reminderHours.js'

const MINUTE_SECONDS = 60
const HOUR_SECONDS = 60 * MINUTE_SECONDS
const DAY_SECONDS = 24 * HOUR_SECONDS
const REMINDER_DAYS = 7
// No reminder goes out later than this into a turn, however far Reminder Hours push them.
// The extra hour absorbs task queue latency, so the plain schedule's last daily reminder,
// due exactly 7 days in, is never cut.
export const TURN_REMINDER_CUTOFF_SECONDS = REMINDER_DAYS * DAY_SECONDS + HOUR_SECONDS

export type TurnAlertStage = 'initial' | 'email' | 'reminder'

export interface TurnReminderStep {
    /** Seconds to wait after the previous reminder (or after the chain starts). */
    delay: number
    /** Which channels the reminder goes to; see DefaultNotificationService.sendNotification. */
    stage: TurnAlertStage
}

// Measured from when the turn started:
//   1 min (push/Discord) -> 5 min (email) -> 24 hours -> daily, ending 7 days into the turn.
// notifyIsYourTurn also stops as soon as it is no longer the player's turn or the game ends.
// A player's Reminder Hours can delay the 24-hour-and-later reminders (never the 1 min / 5 min
// nudges) to their next selected local hour; see turnReminderDelaySeconds.
export const TURN_REMINDER_SCHEDULE: readonly TurnReminderStep[] = [
    { delay: MINUTE_SECONDS, stage: 'initial' },
    { delay: 4 * MINUTE_SECONDS, stage: 'email' },
    { delay: DAY_SECONDS - 5 * MINUTE_SECONDS, stage: 'reminder' },
    ...Array.from({ length: REMINDER_DAYS - 1 }, () => ({
        delay: DAY_SECONDS,
        stage: 'reminder' as const
    }))
]

export const TURN_REMINDER_DELAYS: readonly number[] = TURN_REMINDER_SCHEDULE.map(
    (step) => step.delay
)

export const FIRST_TURN_REMINDER_INDEX = 0
// A game start, or an action that leaves the acting player active, skips the quick
// push/email nudges and starts at the first daily reminder.
export const DEFERRED_TURN_REMINDER_INDEX = TURN_REMINDER_SCHEDULE.findIndex(
    (step) => step.stage === 'reminder'
)

export const TurnReminderTask = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        notificationId: Type.String(),
        reminderIndex: Type.Optional(Type.Number()),
        delay: Type.Optional(Type.Number()),
        // When the chain started (epoch ms), for the 7-day cutoff. Older tasks have none.
        turnStartedAt: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
)
export type TurnReminderTask = Static<typeof TurnReminderTask>

type ScheduledTurnReminder = Omit<TurnReminderTask, 'reminderIndex' | 'delay'> & {
    reminderIndex: number
}

export function turnReminderIndex({ reminderIndex, delay }: TurnReminderTask): number {
    if (reminderIndex !== undefined) {
        return Math.min(Math.max(0, Math.floor(reminderIndex)), TURN_REMINDER_SCHEDULE.length - 1)
    }
    // Tasks queued before reminders were numbered carry only the delay they waited
    // (60 -> 240 -> 86100 -> 86400 daily). Map them onto the schedule the same way the
    // old code staged them; an unknown longer delay continues as a daily reminder.
    const legacyDelay = delay ?? TURN_REMINDER_DELAYS[0]
    const legacyIndex = TURN_REMINDER_DELAYS.indexOf(legacyDelay)
    if (legacyIndex >= 0) {
        return legacyIndex
    }
    if (legacyDelay <= TURN_REMINDER_DELAYS[0]) {
        return 0
    }
    if (legacyDelay <= TURN_REMINDER_DELAYS[1]) {
        return 1
    }
    return DEFERRED_TURN_REMINDER_INDEX + 1
}

export function turnReminderStage(reminderIndex: number): TurnAlertStage {
    return TURN_REMINDER_SCHEDULE[reminderIndex]?.stage ?? 'reminder'
}

export function nextTurnReminderIndex(reminderIndex: number): number | undefined {
    const next = reminderIndex + 1
    return next < TURN_REMINDER_SCHEDULE.length ? next : undefined
}

/**
 * Seconds from `now` until the reminder at `reminderIndex` should go out for `recipient`.
 * The quick nudges (before DEFERRED_TURN_REMINDER_INDEX) always keep their schedule delay.
 * From the 24-hour reminder on, a reminder that falls due outside the recipient's Reminder
 * Hours (in their stored time zone) waits for the start of their next selected local hour.
 * Reminders are only ever delayed, never sent early; the next step is measured from when
 * this one actually goes out. No reminderHours or no time zone means the plain delay.
 */
export function turnReminderDelaySeconds(
    reminderIndex: number,
    now: Date,
    recipient: Pick<User, 'timeZone' | 'preferences'>
): number {
    const delay = TURN_REMINDER_DELAYS[reminderIndex]
    const reminderHours = recipient.preferences?.reminderHours
    if (reminderIndex < DEFERRED_TURN_REMINDER_INDEX || !reminderHours || !recipient.timeZone) {
        return delay
    }
    const due = new Date(now.getTime() + delay * 1000)
    try {
        const sendAt = nextReminderHour(due, recipient.timeZone, reminderHours)
        return Math.ceil((sendAt.getTime() - now.getTime()) / 1000)
    } catch (error) {
        // Scheduling runs inside game actions; a zone this runtime can't resolve must never
        // fail the action, so fall back to the plain schedule.
        console.error('Could not apply reminder hours', recipient.timeZone, error)
        return delay
    }
}

/** Whether a reminder sent `inSeconds` from `now` would land past the turn's 7-day cutoff. */
export function isPastTurnReminderCutoff(
    turnStartedAt: number,
    now: Date,
    inSeconds: number
): boolean {
    return now.getTime() + inSeconds * 1000 > turnStartedAt + TURN_REMINDER_CUTOFF_SECONDS * 1000
}

export async function enqueueTurnReminder(
    tasks: Pick<TaskService, 'createPushTask'>,
    reminder: ScheduledTurnReminder,
    inSeconds: number
): Promise<void> {
    await tasks.createPushTask({
        queue: 'turn-notification',
        path: '/notification/sendTurnNotification',
        inSeconds,
        // Revisions from before reminderIndex strip it as an unknown field and schedule from
        // delay, so it stays the unaligned schedule value even when Reminder Hours push it later.
        payload: { ...reminder, delay: TURN_REMINDER_DELAYS[reminder.reminderIndex] }
    })
}
