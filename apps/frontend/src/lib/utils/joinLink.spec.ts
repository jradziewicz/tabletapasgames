import { describe, expect, it } from 'vitest'
import { GameStatus, GameStorage, PlayerStatus, type Game, type Player } from '@tabletop/common'
import { canShareJoinLink, joinLinkOutcome, joinLinkUrl } from './joinLink'

function player(id: string, overrides: Partial<Player> = {}): Player {
    return { id, name: id, status: PlayerStatus.Open, isHuman: true, ...overrides }
}

function openPublicGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g1',
        name: 'Friday Game',
        typeId: 'test',
        ownerId: 'owner',
        status: GameStatus.WaitingForPlayers,
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01'),
        winningPlayerIds: [],
        storage: GameStorage.Remote,
        players: [
            player('p1', { userId: 'owner', status: PlayerStatus.Joined }),
            player('p2'),
            player('p3')
        ],
        ...overrides
    } as Game
}

describe('join link sharing', () => {
    it('builds the link from the site origin', () => {
        expect(joinLinkUrl('g1', 'https://play.tabletapasgames.com')).toBe(
            'https://play.tabletapasgames.com/join/g1'
        )
    })

    it('offers a link only for open public games with a seat left', () => {
        expect(canShareJoinLink(openPublicGame())).toBe(true)
        expect(canShareJoinLink(openPublicGame({ isPublic: false }))).toBe(false)
        expect(canShareJoinLink(openPublicGame({ status: GameStatus.Started }))).toBe(false)
        expect(canShareJoinLink(openPublicGame({ storage: GameStorage.Local }))).toBe(false)
        expect(
            canShareJoinLink(
                openPublicGame({
                    players: [
                        player('p1', { userId: 'owner', status: PlayerStatus.Joined }),
                        player('p2', { userId: 'u2', status: PlayerStatus.Joined })
                    ]
                })
            )
        ).toBe(false)
    })
})

describe('opening a join link', () => {
    it('shows the join card to someone not yet in an open public game', () => {
        expect(joinLinkOutcome(openPublicGame(), 'visitor')).toEqual({ kind: 'show' })
    })

    it('sends players already in the game back to their dashboard, or into it once started', () => {
        expect(joinLinkOutcome(openPublicGame(), 'owner')).toMatchObject({
            kind: 'redirect',
            to: '/dashboard',
            tone: 'info'
        })
        expect(
            joinLinkOutcome(openPublicGame({ status: GameStatus.Started }), 'owner')
        ).toMatchObject({ kind: 'redirect', to: '/game/g1' })
    })

    it('lets a visitor watch a game that already started', () => {
        expect(
            joinLinkOutcome(openPublicGame({ status: GameStatus.Started }), 'visitor')
        ).toMatchObject({ kind: 'redirect', to: '/game/g1', tone: 'error' })
    })

    it('turns visitors away from private, full, or tournament games', () => {
        expect(joinLinkOutcome(openPublicGame({ isPublic: false }), 'visitor')).toMatchObject({
            kind: 'redirect',
            to: '/dashboard',
            message: 'Friday Game is invite-only.'
        })
        const full = openPublicGame({
            status: GameStatus.WaitingToStart,
            players: [
                player('p1', { userId: 'owner', status: PlayerStatus.Joined }),
                player('p2', { userId: 'u2', status: PlayerStatus.Joined })
            ]
        })
        expect(joinLinkOutcome(full, 'visitor')).toMatchObject({
            kind: 'redirect',
            message: "Friday Game isn't taking new players anymore."
        })
        expect(
            joinLinkOutcome(
                openPublicGame({ tournament: { tournamentId: 't1' } } as Partial<Game>),
                'visitor'
            )
        ).toMatchObject({ kind: 'redirect', to: '/dashboard' })
    })

    it('still shows the card to someone invited by name to a private game', () => {
        const invited = openPublicGame({
            isPublic: false,
            players: [
                player('p1', { userId: 'owner', status: PlayerStatus.Joined }),
                player('p2', { userId: 'friend', status: PlayerStatus.Reserved })
            ]
        })
        expect(joinLinkOutcome(invited, 'friend')).toEqual({ kind: 'show' })
    })
})
