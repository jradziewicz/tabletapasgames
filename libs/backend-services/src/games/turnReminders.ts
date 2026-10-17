import { Type, type Static } from 'typebox'
import type { TaskService } from '../tasks/taskService.js'

const MINUTE_SECONDS = 60
const HOUR_SECONDS = 60 * MINUTE_SECONDS
const DAY_SECONDS = 24 * HOUR_SECONDS
const REMINDER_DAYS = 7

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
        delay: Type.Optional(Type.Number())
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

export async function enqueueTurnReminder(
    tasks: Pick<TaskService, 'createPushTask'>,
    reminder: ScheduledTurnReminder
): Promise<void> {
    const inSeconds = TURN_REMINDER_DELAYS[reminder.reminderIndex]
    await tasks.createPushTask({
        queue: 'turn-notification',
        path: '/notification/sendTurnNotification',
        inSeconds,
        // Revisions from before reminderIndex strip it as an unknown field and schedule from delay.
        payload: { ...reminder, delay: inSeconds }
    })
}
