import { describe, expect, it } from 'vitest'
import { DiscordWebhookTransport } from './discordWebhookTransport.js'
import { InvalidDiscordWebhookUrlError } from '../errors.js'

const good = 'https://discord.com/api/webhooks/123456789012345678/abcDEF-ghi_JKL789'

describe('DiscordWebhookTransport.normalizeWebhookUrl', () => {
    it('accepts a standard Discord webhook URL', () => {
        expect(DiscordWebhookTransport.normalizeWebhookUrl(good)).toBe(good)
    })

    it('accepts the other Discord hosts and versioned paths, and strips ?wait / trailing slash', () => {
        expect(
            DiscordWebhookTransport.normalizeWebhookUrl(
                '  https://discordapp.com/api/v10/webhooks/1/tok/?wait=true '
            )
        ).toBe('https://discordapp.com/api/v10/webhooks/1/tok')
        expect(
            DiscordWebhookTransport.normalizeWebhookUrl('https://ptb.discord.com/api/webhooks/1/tok')
        ).toBe('https://ptb.discord.com/api/webhooks/1/tok')
    })

    it('rejects anything that is not a Discord webhook (SSRF guard)', () => {
        for (const bad of [
            'not a url',
            'http://discord.com/api/webhooks/1/tok', // plain http
            'https://evil.example.com/api/webhooks/1/tok',
            'https://discord.com.evil.example/api/webhooks/1/tok',
            'https://discord.com/api/channels/1/messages',
            'https://discord.com/api/webhooks/1/tok/extra/segments',
            'https://169.254.169.254/api/webhooks/1/tok'
        ]) {
            expect(() => DiscordWebhookTransport.normalizeWebhookUrl(bad), bad).toThrow(
                InvalidDiscordWebhookUrlError
            )
        }
    })
})

describe('DiscordWebhookTransport.maskWebhookUrl', () => {
    it('hides the token segment only', () => {
        expect(DiscordWebhookTransport.maskWebhookUrl(good)).toBe(
            'https://discord.com/api/webhooks/123456789012345678/…'
        )
    })
})
