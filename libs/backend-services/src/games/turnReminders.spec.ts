import { describe, expect, it, vi } from 'vitest'
import * as Value from 'typebox/value'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    enqueueTurnReminder,
    FIRST_TURN_REMINDER_INDEX,
    nextTurnReminderIndex,
    TURN_REMINDER_DELAYS,
    turnReminderIndex,
    turnReminderStage,
    TurnReminderTask
} from './turnReminders.js'
import type { TaskService } from '../tasks/taskService.js'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function reminders(): { at: number; stage: string }[] {
    const times: { at: number; stage: string }[] = []
    let elapsed = 0
    let reminderIndex: number | undefined = FIRST_TURN_REMINDER_INDEX
    while (reminderIndex !== undefined) {
        elapsed += TURN_REMINDER_DELAYS[reminderIndex]
        times.push({ at: elapsed, stage: turnReminderStage(reminderIndex) })
        reminderIndex = nextTurnReminderIndex(reminderIndex)
    }
    return times
}

function task(fields: Pick<TurnReminderTask, 'reminderIndex' | 'delay'>): TurnReminderTask {
    return { userId: 'user', gameId: 'game', notificationId: 'notification', ...fields }
}

describe('turn reminders', () => {
    it('pings after a minute, emails at five minutes, then reminds daily for a week', () => {
        expect(reminders()).toEqual([
            { at: MINUTE, stage: 'initial' },
            { at: 5 * MINUTE, stage: 'email' },
            ...Array.from({ length: 7 }, (_, day) => ({ at: (day + 1) * DAY, stage: 'reminder' }))
        ])
    })

    it('starts a deferred chain at the first daily reminder', () => {
        expect(DEFERRED_TURN_REMINDER_INDEX).toBe(2)
        expect(turnReminderStage(DEFERRED_TURN_REMINDER_INDEX)).toBe('reminder')
    })

    it('queues the reminder after its delay with the delay alongside its index', async () => {
        const createPushTask = vi.fn<TaskService['createPushTask']>(async () => {})
        await enqueueTurnReminder(
            { createPushTask },
            { userId: 'user', gameId: 'game', notificationId: 'notification', reminderIndex: 1 }
        )
        expect(createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'turn-notification',
            path: '/notification/sendTurnNotification',
            inSeconds: 4 * MINUTE,
            payload: {
                userId: 'user',
                gameId: 'game',
                notificationId: 'notification',
                reminderIndex: 1,
                delay: 4 * MINUTE
            }
        })
    })

    it('accepts tasks queued before reminders were numbered', () => {
        expect(Value.Check(TurnReminderTask, task({ delay: 4 * MINUTE }))).toBe(true)
    })

    it('continues tasks queued before reminders were numbered from the delay they waited', () => {
        expect(turnReminderIndex(task({}))).toBe(0)
        expect(turnReminderIndex(task({ delay: 60 }))).toBe(0)
        expect(turnReminderIndex(task({ delay: 4 * MINUTE }))).toBe(1)
        expect(turnReminderIndex(task({ delay: DAY - 5 * MINUTE }))).toBe(2)
        expect(turnReminderIndex(task({ delay: DAY }))).toBe(3)
        expect(turnReminderIndex(task({ delay: 2 * DAY }))).toBe(3)
    })

    it('prefers the reminder index over the delay', () => {
        expect(turnReminderIndex(task({ reminderIndex: 5, delay: 60 }))).toBe(5)
    })
})
