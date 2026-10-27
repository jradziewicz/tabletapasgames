import { assertExists, GameResult, GameStatus, type Game, type Player } from '@tabletop/common'

// Builds the "Post to BG Stats" link documented at
// https://www.bgstatsapp.com/support/push-plays-to-bg-stats-from-other-apps-or-websites/

const BG_STATS_SOURCE_NAME = 'TableTapas Games'
const BG_STATS_CREATE_PLAY_URL = 'https://app.bgstatsapp.com/createPlay.html'

// Titles missing here have no BGG listing; BG Stats then offers to create a custom game by name.
const BGG_IDS_BY_TITLE_ID: Record<string, number> = {
    stellarventures: 359963
}

type BgStatsPlayer = {
    name: string
    sourcePlayerId: string
    winner: boolean
    score?: number
}

type BgStatsPlay = {
    sourceName: string
    sourcePlayId: string
    playDate: string
    location: string
    game: {
        name: string
        sourceGameId: string
        bggId?: number
        highestWins: boolean
        noPoints: boolean
    }
    players: BgStatsPlayer[]
}

// Games whose scores only mark the winner (1/0) have no real scores to show or export.
export function meaningfulFinalScores(game: Game): Record<string, number> | undefined {
    const scores = game.finalScores
    if (game.status !== GameStatus.Finished || !scores) return undefined
    if (!game.players.every((player) => Number.isFinite(scores[player.id]))) return undefined
    const onlyMarkWinners = game.players.every(
        (player) => scores[player.id] === (game.winningPlayerIds.includes(player.id) ? 1 : 0)
    )
    return onlyMarkWinners ? undefined : scores
}

export function canPostToBgStats(game: Game, userId: string | undefined): boolean {
    return (
        game.status === GameStatus.Finished &&
        game.finishedAt !== undefined &&
        game.result !== undefined &&
        game.result !== GameResult.Abandoned &&
        game.players.some((player) => player.userId !== undefined && player.userId === userId)
    )
}

// BG Stats wants the UTC end time as "yyyy-MM-dd HH:mm:ss".
function bgStatsDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ')
}

function bgStatsPlayer(game: Game, player: Player, scores: Record<string, number> | undefined) {
    const bgStatsPlayer: BgStatsPlayer = {
        name: player.name,
        sourcePlayerId: player.userId ?? `${game.id}:${player.id}`,
        winner: game.winningPlayerIds.includes(player.id)
    }
    if (scores) bgStatsPlayer.score = scores[player.id]
    return bgStatsPlayer
}

export function bgStatsPlay(game: Game, titleName: string): BgStatsPlay {
    assertExists(game.finishedAt, 'A finished game must have a finish time')
    const scores = meaningfulFinalScores(game)
    return {
        sourceName: BG_STATS_SOURCE_NAME,
        sourcePlayId: game.id,
        playDate: bgStatsDate(new Date(game.finishedAt)),
        location: BG_STATS_SOURCE_NAME,
        game: {
            name: titleName,
            sourceGameId: game.typeId,
            bggId: BGG_IDS_BY_TITLE_ID[game.typeId],
            highestWins: true,
            noPoints: scores === undefined
        },
        players: game.players.map((player) => bgStatsPlayer(game, player, scores))
    }
}

// encodeURIComponent rather than URLSearchParams, which would turn spaces into '+'.
export function bgStatsPlayUrl(game: Game, titleName: string): string {
    const data = encodeURIComponent(JSON.stringify(bgStatsPlay(game, titleName)))
    return `${BG_STATS_CREATE_PLAY_URL}?data=${data}`
}
