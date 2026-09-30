// Usage: node analyze-playtest.mjs <playtests dir or file> [--latest]
// Reads "Save playtest" exports (format rocky-playtest-1) and prints a Markdown report for the
// newest game plus a comparison table across every game in the folder.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const target = process.argv[2] ?? '.'
const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith('.json')).map((f) => join(target, f))
    : [target]
const games = files
    .map((file) => ({ file, data: JSON.parse(readFileSync(file, 'utf8')) }))
    .filter((g) => g.data.format === 'rocky-playtest-1')
    .sort((a, b) => a.data.exportedAt.localeCompare(b.data.exportedAt))
if (games.length === 0) {
    console.log('No playtest exports found in', target)
    process.exit(0)
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const avg = (xs) => (xs.length ? sum(xs) / xs.length : 0)
const money = (n) => (n < 0 ? `-$${-n}` : `$${n}`)

function nameOf(g, id) {
    if (id === 'dummy') return 'Dummy'
    const p = g.game.players.find((x) => x.id === id)
    return p ? `${p.name}${p.color ? ` (${p.color})` : ''}` : id
}

function summarize(g) {
    const ev = g.state.statEvents ?? []
    const ids = [...g.turnOrder, ...(g.state.dummy ? ['dummy'] : [])]
    const by = (filter, key) => {
        const m = {}
        for (const e of ev.filter(filter)) m[key(e)] = (m[key(e)] ?? 0) + e.amount
        return m
    }
    const players = ids.map((id) => {
        const mine = (e) => e.playerId === id
        const score = g.finalScores.find((s) => s.playerId === id)
        return {
            id,
            name: nameOf(g, id),
            score,
            won: g.winners.includes(id) || (id === 'dummy' && g.dummyWon),
            actions: by((e) => mine(e) && e.kind === 'action', (e) => e.source),
            vp: by((e) => mine(e) && e.kind === 'vp', (e) => e.source),
            cash: by((e) => mine(e) && e.kind === 'cash', (e) => e.source),
            purchases: ev.filter((e) => mine(e) && e.kind === 'purchase').map((e) => ({ card: e.cardId, cost: e.amount })),
            gemsGained: sum(ev.filter((e) => mine(e) && e.kind === 'gemGain').map((e) => e.amount)),
            gemsSpent: by((e) => mine(e) && e.kind === 'gemSpend', (e) => e.source),
            claims: ev.filter((e) => mine(e) && e.kind === 'mineClaim'),
            extracts: ev.filter((e) => mine(e) && e.kind === 'mineExtract'),
            tracks: ev.filter((e) => mine(e) && e.kind === 'track').length,
            copies: ev.filter((e) => mine(e) && e.kind === 'action' && e.copy).length,
            agreementCash: by((e) => mine(e) && e.kind === 'cash' && e.agreement, (e) => e.agreement)
        }
    })
    const cards = {}
    for (const e of ev) {
        if (!e.cardId) continue
        const c = (cards[e.cardId] ??= { bought: 0, cost: 0, triggers: 0, copies: 0, cash: 0, vp: 0 })
        if (e.kind === 'purchase') { c.bought++; c.cost += e.amount }
        if (e.kind === 'action') { c.triggers++; if (e.copy) c.copies++ }
        if (e.kind === 'cash' && !['purchase', 'claim', 'pointBuy'].includes(e.source)) c.cash += e.amount
        if (e.kind === 'vp') c.vp += e.amount
    }
    const mines = {}
    for (const e of ev.filter((x) => x.kind === 'mineExtract')) {
        const m = (mines[e.nodeId] ??= { extracts: 0, net: 0 })
        m.extracts++
        m.net += e.amount
    }
    const s = g.state
    return {
        g, players, cards, mines,
        rounds: g.rounds,
        playerCount: g.turnOrder.length,
        triggers: Object.entries(g.endTriggers).filter(([, v]) => v).map(([k]) => k),
        dragon: s.dragon,
        gemsSpent: s.gemsSpent,
        scourgesKilled: s.removedScourges.length,
        companies: s.companies.map((c) => ({ id: c.id, cubes: c.cubesOnMap, delivered: c.deliveredMineTokenIds.length, treasury: c.treasury })),
        margin: (() => {
            const t = g.finalScores.map((x) => x.total).sort((a, b) => b - a)
            return t.length > 1 ? t[0] - t[1] : 0
        })()
    }
}

const all = games.map((x) => summarize(x.data))
const latest = all[all.length - 1]
const lines = []
const out = (s = '') => lines.push(s)

out(`# Playtest report: ${latest.g.game.name ?? latest.g.game.id}`)
out(`Exported ${latest.g.exportedAt} · ${latest.playerCount} players${latest.g.state.dummy ? ' + dummy' : ''} · ${latest.rounds} rounds · ended by ${latest.triggers.join(' + ')}`)
out()
out('## Final scores')
out('| Player | VP track | Cash | Shares cashed | Cash→VP | Final |')
out('|---|---|---|---|---|---|')
for (const p of [...latest.players].sort((a, b) => b.score.total - a.score.total)) {
    out(`| ${p.won ? '🏆 ' : ''}${p.name} | ${p.score.victoryPoints} | ${money(p.score.money)} | ${money(p.score.shareValue)} | +${p.score.conversionVictoryPoints} | **${p.score.total}** |`)
}
out()
out('## VP sources')
const vpKeys = [...new Set(latest.players.flatMap((p) => Object.keys(p.vp)))]
out(`| Player | ${vpKeys.join(' | ')} |`)
out(`|---|${vpKeys.map(() => '---').join('|')}|`)
for (const p of latest.players) out(`| ${p.name} | ${vpKeys.map((k) => p.vp[k] ?? 0).join(' | ')} |`)
out()
out('## Cash sources')
const cashKeys = [...new Set(latest.players.flatMap((p) => Object.keys(p.cash)))]
out(`| Player | ${cashKeys.join(' | ')} |`)
out(`|---|${cashKeys.map(() => '---').join('|')}|`)
for (const p of latest.players) out(`| ${p.name} | ${cashKeys.map((k) => money(p.cash[k] ?? 0)).join(' | ')} |`)
out()
out('## Actions taken')
const actKeys = [...new Set(latest.players.flatMap((p) => Object.keys(p.actions)))]
out(`| Player | ${actKeys.join(' | ')} | Total |`)
out(`|---|${actKeys.map(() => '---').join('|')}|---|`)
for (const p of latest.players) out(`| ${p.name} | ${actKeys.map((k) => p.actions[k] ?? 0).join(' | ')} | ${sum(Object.values(p.actions))} |`)
out()
out('## Players: purchases, mines, gems')
for (const p of latest.players) {
    out(`- **${p.name}** — bought ${p.purchases.map((x) => `${x.card} ${money(x.cost)}`).join(', ') || 'nothing'}; claimed ${p.claims.map((c) => `${c.nodeId} ${money(c.amount)}`).join(', ') || 'none'}; ${p.extracts.length} extracts for ${money(sum(p.extracts.map((e) => e.amount)))}; ${p.tracks} tracks; gems +${p.gemsGained} / spent ${JSON.stringify(p.gemsSpent)}; copies ${p.copies}; agreement cash ${JSON.stringify(p.agreementCash)}`)
}
out()
out('## Cards')
out('| Card | Bought | Cost | Triggers | Copies | Cash earned | VP earned |')
out('|---|---|---|---|---|---|---|')
for (const [id, c] of Object.entries(latest.cards).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    out(`| ${id} | ${c.bought} | ${c.bought ? money(c.cost) : '–'} | ${c.triggers} | ${c.copies} | ${money(c.cash)} | ${c.vp} |`)
}
out()
out('## Mines extracted')
out('| Mine | Extracts | Net cash |')
out('|---|---|---|')
for (const [id, m] of Object.entries(latest.mines).sort((a, b) => b[1].net - a[1].net)) out(`| ${id} | ${m.extracts} | ${money(m.net)} |`)
out()
out('## Table')
out(`- Dragon: ${latest.dragon.summoned ? `summoned, ${latest.dragon.hits} hits${latest.dragon.killed ? ', killed' : ''}` : 'not summoned'} · scourges killed ${latest.scourgesKilled} · gems spent ${latest.gemsSpent}`)
out(`- Railroads: ${latest.companies.map((c) => `${c.id} ${c.cubes} cubes, ${c.delivered} deliveries`).join(' · ')}`)
out()
out(`## All playtests (${all.length})`)
out('| # | Date | Players | Rounds | Ended by | Winner | Win score | Margin | Dummy |')
out('|---|---|---|---|---|---|---|---|---|')
all.forEach((x, i) => {
    const w = x.players.filter((p) => p.won)
    const dummy = x.players.find((p) => p.id === 'dummy')
    out(`| ${i + 1} | ${x.g.exportedAt.slice(0, 10)} | ${x.playerCount}${dummy ? '+D' : ''} | ${x.rounds} | ${x.triggers.join(' + ')} | ${w.map((p) => p.name).join(', ')} | ${Math.max(...x.players.map((p) => p.score.total))} | ${x.margin} | ${dummy ? dummy.score.total : '–'} |`)
})
out()
out(`Averages: rounds ${avg(all.map((x) => x.rounds)).toFixed(1)} · winning score ${avg(all.map((x) => Math.max(...x.players.map((p) => p.score.total)))).toFixed(1)} · margin ${avg(all.map((x) => x.margin)).toFixed(1)}`)
console.log(lines.join('\n'))
