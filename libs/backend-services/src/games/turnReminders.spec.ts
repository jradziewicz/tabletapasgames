import { describe, expect, it, vi } from 'vitest'
import * as Value from 'typebox/value'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    enqueueTurnReminder,
    FIRST_TURN_REMINDER_INDEX,
    nextTurnReminderIndex,
    TURN_REMINDER_DELAYS,
    turnReminderDelaySeconds,
    turnReminderIndex,
    turnReminderStage,
    TurnReminderTask
} from './turnReminders.js'
import type { TaskService } from '../tasks/taskService.js'
import { weekReminderHours, type User } from '@tabletop/common'

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

    it('queues the reminder when it is due, with its scheduled delay and index', async () => {
        const createPushTask = vi.fn<TaskService['createPushTask']>(async () => {})
        await enqueueTurnReminder(
            { createPushTask },
            { userId: 'user', gameId: 'game', notificationId: 'notification', reminderIndex: 1 },
            10 * MINUTE
        )
        expect(createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'turn-notification',
            path: '/notification/sendTurnNotification',
            inSeconds: 10 * MINUTE,
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

describe('turn reminders in reminder hours', () => {
    const recipient: Pick<User, 'timeZone' | 'preferences'> = {
        timeZone: 'America/Chicago',
        preferences: {
            preventWebNotificationPrompt: false,
            preferredColorsEnabled: false,
            preferredColors: [],
            reminderHours: weekReminderHours([18, 19, 20, 21])
        }
    }
    // 7:00 am Friday in Chicago; 6:00 pm Saturday there is 23:00 UTC.
    const fridayMorning = new Date('2026-10-16T12:00:00.000Z')
    const saturdayEvening = new Date('2026-10-17T23:00:00.000Z')
    const secondsUntil = (time: Date) => (time.getTime() - fridayMorning.getTime()) / 1000

    it('sends the one and five minute nudges at their usual delay', () => {
        expect(turnReminderDelaySeconds(0, fridayMorning, recipient)).toBe(MINUTE)
        expect(turnReminderDelaySeconds(1, fridayMorning, recipient)).toBe(4 * MINUTE)
    })

    it('waits for a reminder hour from the 24 hour reminder on', () => {
        expect(
            turnReminderDelaySeconds(DEFERRED_TURN_REMINDER_INDEX, fridayMorning, recipient)
        ).toBe(secondsUntil(saturdayEvening))
        expect(turnReminderDelaySeconds(3, fridayMorning, recipient)).toBe(
            secondsUntil(saturdayEvening)
        )
    })

    it('keeps the daily delay once a reminder already lands in a reminder hour', () => {
        expect(turnReminderDelaySeconds(3, saturdayEvening, recipient)).toBe(DAY)
    })

    it('keeps the usual delay without reminder hours or a time zone', () => {
        expect(turnReminderDelaySeconds(4, fridayMorning, {})).toBe(DAY)
        expect(
            turnReminderDelaySeconds(4, fridayMorning, { preferences: recipient.preferences })
        ).toBe(DAY)
    })
})
