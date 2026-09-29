import { GameCategory, GameStatus, type Game } from '@tabletop/common'
import { compareGameInvitations } from './gameInvitation'

export function currentDashboardGames(active: Game[], waiting: Game[], userId?: string): Game[] {
    return [...active, ...waiting].toSorted((a, b) => compareGameInvitations(a, b, userId))
}

export function isUsersGameTurn(game: Game, userId?: string): boolean {
    return (
        userId !== undefined &&
        game.status === GameStatus.Started &&
        game.players.some(
            (player) => player.userId === userId && game.activePlayerIds?.includes(player.id)
        )
    )
}

// A turn in a real-time game (hotseat games are played on one device, so there is nothing to
// "come back to" for them).
export function isUsersNonHotseatTurn(game: Game, userId?: string): boolean {
    return !game.hotseat && isUsersGameTurn(game, userId)
}

// Every other game (not the one being viewed) where it is currently the user's turn.
export function otherTurnGames(games: Game[], currentGameId: string, userId?: string): Game[] {
    return games.filter(
        (game) =>
            game.id !== currentGameId &&
            game.category !== GameCategory.Exploration &&
            isUsersNonHotseatTurn(game, userId)
    )
}

// The game to jump to next: cycles through the waiting games in a stable (id) order, starting
// after the current one and wrapping around, so repeated presses walk the whole list instead of
// bouncing between the same two games.
export function nextTurnGame(
    games: Game[],
    currentGameId: string,
    userId?: string
): Game | undefined {
    const candidates = otherTurnGames(games, currentGameId, userId).toSorted((a, b) =>
        a.id.localeCompare(b.id)
    )
    return candidates.find((game) => game.id.localeCompare(currentGameId) > 0) ?? candidates[0]
}
