import { GameStatus, GameStorage, PlayerStatus, type Game } from '@tabletop/common'
import { hasPendingGameInvitation } from './gameInvitation'

// Shareable join links for open public games: GameCard's "Copy Join Link" button hands out
// joinLinkUrl, and routes/join/[id] uses joinLinkOutcome to decide whether to show the
// "Join this game?" card or send the visitor somewhere more useful.

export function joinLinkUrl(gameId: string, origin: string): string {
    return new URL(`/join/${gameId}`, origin).href
}

function hasOpenSeat(game: Game): boolean {
    return game.players.some((player) => player.status === PlayerStatus.Open)
}

// Only a public, server-hosted game still waiting for players, with a seat left, is worth a link.
export function canShareJoinLink(game: Game): boolean {
    return (
        !game.tournament &&
        game.isPublic &&
        game.storage !== GameStorage.Local &&
        game.status === GameStatus.WaitingForPlayers &&
        hasOpenSeat(game)
    )
}

export type JoinLinkOutcome =
    | { kind: 'show' }
    | { kind: 'redirect'; to: string; message: string; tone: 'info' | 'error' }

export function joinLinkOutcome(game: Game, userId: string | undefined): JoinLinkOutcome {
    const myPlayer = game.players.find((player) => player.userId === userId)
    if (myPlayer?.status === PlayerStatus.Joined) {
        return {
            kind: 'redirect',
            to: game.status === GameStatus.Started ? `/game/${game.id}` : '/dashboard',
            message: `You're already in ${game.name}.`,
            tone: 'info'
        }
    }

    if (game.status === GameStatus.Started) {
        return {
            kind: 'redirect',
            to: `/game/${game.id}`,
            message: `${game.name} has already started. You can still watch it.`,
            tone: 'error'
        }
    }

    // Someone invited by name can use the link too - GameCard shows Join/Decline for them.
    if (hasPendingGameInvitation(game, userId)) {
        return { kind: 'show' }
    }

    if (!game.isPublic || game.tournament) {
        return {
            kind: 'redirect',
            to: '/dashboard',
            message: `${game.name} is invite-only.`,
            tone: 'error'
        }
    }

    if (game.status !== GameStatus.WaitingForPlayers || !hasOpenSeat(game)) {
        return {
            kind: 'redirect',
            to: '/dashboard',
            message: `${game.name} isn't taking new players anymore.`,
            tone: 'error'
        }
    }

    return { kind: 'show' }
}
