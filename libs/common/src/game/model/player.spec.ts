import { describe, expect, it } from 'vitest'
import { PlayerStatus, playersWithDeletedAccount, type Player } from './player.js'

const seat = (id: string, userId: string | undefined, name: string): Player => ({
    id,
    isHuman: true,
    userId,
    name,
    status: PlayerStatus.Joined
})

describe('playersWithDeletedAccount', () => {
    it('renames the seat, numbering deleted players within the game', () => {
        const players = [
            seat('1', 'x', 'Deleted player 1'),
            seat('2', 'a', 'Alice'),
            seat('3', 'b', 'Bob')
        ]
        expect(playersWithDeletedAccount(players, 'a')?.map((player) => player.name)).toEqual([
            'Deleted player 1',
            'Deleted player 2',
            'Bob'
        ])
    })

    it('leaves a game without the account, or already renamed, alone', () => {
        expect(playersWithDeletedAccount([seat('1', 'b', 'Bob')], 'a')).toBeUndefined()
        expect(playersWithDeletedAccount([seat('1', 'a', 'Deleted player 1')], 'a')).toBeUndefined()
    })
})
