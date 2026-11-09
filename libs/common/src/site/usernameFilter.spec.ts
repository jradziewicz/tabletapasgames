import { describe, expect, it } from 'vitest'
import { isInappropriateUsername } from './usernameFilter.js'

describe('isInappropriateUsername', () => {
    it.each([
        'fuck',
        'xXFuckXx',
        'F.U.C.K',
        'fuuuuck_you',
        'N1gg3r',
        'nigga42',
        'Sh1tHead',
        'big-dick-energy',
        'BigDick',
        'ass_master',
        'HeilHitler88',
        'kkk_member',
        'faggot',
        'dumb_fag'
    ])('blocks %s', (name) => {
        expect(isInappropriateUsername(name)).toBe(true)
    })

    it.each([
        'Justin',
        'Glomzig',
        'Studs_Terkel',
        'Cassandra',
        'BassPlayer',
        'Dickens',
        'Peacock',
        'Hitchcock',
        'Scunthorpe',
        'Yamashita',
        'Kinoshita',
        'Fukuda',
        'Nigel',
        'Niger',
        'Diana_Lee',
        'Analyst',
        'Therapist',
        'grapefruit',
        'Sussex',
        'Matsushita',
        'Penistone',
        'classicgamer',
        'Spaceballs',
        'Cocoa'
    ])('allows %s', (name) => {
        expect(isInappropriateUsername(name)).toBe(false)
    })
})
