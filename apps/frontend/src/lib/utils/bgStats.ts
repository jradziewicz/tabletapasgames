import { assertExists, GameResult, GameStatus, type Game, type Player } from '@tabletop/common'

// Builds the "Post to BG Stats" link documented at
// https://www.bgstatsapp.com/support/push-plays-to-bg-stats-from-other-apps-or-websites/

const BG_STATS_SOURCE_NAME = 'TableTapas Games'
const BG_STATS_CREATE_PLAY_URL = 'https://app.bgstatsapp.com/createPlay.html'

// The Android app reads every field of the documented example with org.json's strict getters,
// so a missing "optional" field fails the whole import. Always send each one, with a neutral value.

// Async games can run for days; longer durations would be wall-clock time, not play time.
const MAX_DURATION_MIN = 12 * 60

// Titles missing here have no BGG listing and are sent with bggId 0; BG Stats then offers to
// create a custom game by name.
const BGG_IDS_BY_TITLE_ID: Record<string, number> = {
    stellarventures: 359963
}

type BgStatsPlayer = {
    name: string
    sourcePlayerId: string
    winner: boolean
    startPlayer: boolean
    score: number
    rank: number
    role: string
}

type BgStatsPlay = {
    sourceName: string
    sourcePlayId: string
    playDate: string
    durationMin: number
    location: string
    board: string
    comments: string
    game: {
        name: string
        sourceGameId: string
        bggId: number
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

// Zero tells BG Stats the duration is unknown.
function bgStatsDurationMin(game: Game, finishedAt: Date): number {
    if (!game.startedAt) return 0
    const minutes = Math.round((finishedAt.getTime() - new Date(game.startedAt).getTime()) / 60000)
    return minutes > 0 && minutes <= MAX_DURATION_MIN ? minutes : 0
}

// Ranks start at 1 and tie on equal scores; without scores, winners rank 1 and everyone else 2.
function bgStatsRank(game: Game, player: Player, scores: Record<string, number> | undefined) {
    if (!scores) return game.winningPlayerIds.includes(player.id) ? 1 : 2
    return 1 + game.players.filter((other) => scores[other.id] > scores[player.id]).length
}

function bgStatsPlayer(
    game: Game,
    player: Player,
    scores: Record<string, number> | undefined
): BgStatsPlayer {
    return {
        name: player.name,
        sourcePlayerId: player.userId ?? `${game.id}:${player.id}`,
        winner: game.winningPlayerIds.includes(player.id),
        // The site doesn't record who went first across titles.
        startPlayer: false,
        score: scores?.[player.id] ?? 0,
        rank: bgStatsRank(game, player, scores),
        role: ''
    }
}

export function bgStatsPlay(game: Game, titleName: string): BgStatsPlay {
    assertExists(game.finishedAt, 'A finished game must have a finish time')
    const scores = meaningfulFinalScores(game)
    const finishedAt = new Date(game.finishedAt)
    return {
        sourceName: BG_STATS_SOURCE_NAME,
        sourcePlayId: game.id,
        playDate: bgStatsDate(finishedAt),
        durationMin: bgStatsDurationMin(game, finishedAt),
        location: BG_STATS_SOURCE_NAME,
        board: '',
        comments: '',
        game: {
            name: titleName,
            sourceGameId: game.typeId,
            bggId: BGG_IDS_BY_TITLE_ID[game.typeId] ?? 0,
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
