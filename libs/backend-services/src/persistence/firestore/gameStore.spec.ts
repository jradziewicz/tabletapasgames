import { Firestore } from '@google-cloud/firestore'
import * as Value from 'typebox/value'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { RedisCacheService } from '../../cache/cacheService.js'
import { StoredGame } from '../model/storedGame.js'
import { FirestoreGameStore } from './gameStore.js'

describe('FirestoreGameStore action ranges', () => {
    const firestore = new Firestore({ projectId: 'tabletop-test' })
    const store = new FirestoreGameStore(Object.create(RedisCacheService.prototype), firestore)

    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('returns no actions without reading Firestore when the range is empty', async () => {
        const game = Value.Create(StoredGame)
        game.id = 'game-id'
        game.actionChunkSize = 200
        const getAll = vi.spyOn(firestore, 'getAll')

        const actions = await store.findActionRangeForGame({
            game,
            startIndex: 14,
            endIndex: 13
        })

        expect(actions).toEqual([])
        expect(getAll).not.toHaveBeenCalled()
    })
})

describe('FirestoreGameStore.archiveGame', () => {
    const firestore = new Firestore({ projectId: 'tabletop-test' })
    const store = new FirestoreGameStore(Object.create(RedisCacheService.prototype), firestore)

    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('writes the game, its final state and every action in 100-action chunks', async () => {
        const game = Value.Create(StoredGame) as StoredGame & { state?: unknown }
        game.id = 'game-id'
        game.typeId = 'stellarventures'
        game.state = { actionCount: 250 } as never
        const actions = Array.from({ length: 250 }, (_, index) => ({ id: `a${index}`, index }))
        vi.spyOn(store, 'readGameData').mockImplementation(async (_gameId, read) =>
            read({
                game,
                actions: async () => actions,
                actionRange: async () => [],
                undoWindow: async () => undefined
            } as never)
        )
        const writes: { path: string; data: Record<string, unknown> }[] = []
        vi.spyOn(firestore, 'batch').mockReturnValue({
            set: (ref: { path: string }, data: Record<string, unknown>) => {
                writes.push({ path: ref.path, data })
            },
            commit: async () => []
        } as never)

        await store.archiveGame('game-id')

        expect(writes.map((write) => write.path)).toEqual([
            'gameArchives/game-id',
            'gameArchives/game-id/actionChunks/chunk-0',
            'gameArchives/game-id/actionChunks/chunk-1',
            'gameArchives/game-id/actionChunks/chunk-2'
        ])
        const archive = writes[0]!.data
        expect(archive.actionCount).toBe(250)
        expect(archive.chunkCount).toBe(3)
        expect(JSON.parse(archive.stateData as string)).toEqual(game.state)
        expect(JSON.parse(archive.gameData as string).state).toBeUndefined()
        const archived = writes
            .slice(1)
            .flatMap((write) => JSON.parse(write.data.actionsData as string))
        expect(archived).toEqual(actions)
    })
})
