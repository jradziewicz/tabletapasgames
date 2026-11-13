import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrevoEmailService } from './brevoEmailService.js'
import { NullEmailService } from './nullEmailService.js'
import type { SecretsService } from '../secrets/secretsService.js'

function secrets(values: Record<string, string>): SecretsService {
    return {
        async getSecret(name: string) {
            return values[name] as string
        }
    }
}

describe('BrevoEmailService', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        delete process.env['BREVO_SENDER_EMAIL']
        delete process.env['BREVO_SENDER_NAME']
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('falls back to the null service when the API key is empty', async () => {
        const service = await BrevoEmailService.createEmailService(secrets({ BREVO_API_KEY: '' }))
        expect(service).toBeInstanceOf(NullEmailService)
    })

    it('sends a turn email through the Brevo API', async () => {
        fetchMock.mockResolvedValue(new Response('{"messageId":"x"}', { status: 201 }))
        const service = await BrevoEmailService.createEmailService(
            secrets({ BREVO_API_KEY: 'test-key' })
        )

        await service.sendTurnNotificationEmail({
            title: 'Stellar Ventures',
            gameName: 'Friday game',
            url: 'https://play.tabletapasgames.com/game/1',
            toEmail: 'player@example.com'
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.brevo.com/v3/smtp/email')
        expect(init.headers['api-key']).toBe('test-key')
        const body = JSON.parse(init.body)
        expect(body.sender).toEqual({
            email: 'noreply@playtest.tabletapasgames.com',
            name: 'TableTapas Games'
        })
        expect(body.to).toEqual([{ email: 'player@example.com' }])
        expect(body.subject).toBe("It's your turn in Friday game!")
        expect(body.htmlContent).toContain('Friday game')
        expect(body.textContent).toContain('https://play.tabletapasgames.com/game/1')
    })

    it('uses the configured sender', async () => {
        process.env['BREVO_SENDER_EMAIL'] = 'hello@tabletapasgames.com'
        process.env['BREVO_SENDER_NAME'] = 'TableTapas'
        fetchMock.mockResolvedValue(new Response('{}', { status: 201 }))
        const service = await BrevoEmailService.createEmailService(
            secrets({ BREVO_API_KEY: 'test-key' })
        )

        await service.sendVerificationEmail('123456', 'player@example.com')

        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.sender).toEqual({ email: 'hello@tabletapasgames.com', name: 'TableTapas' })
    })

    it('throws when Brevo rejects the email', async () => {
        fetchMock.mockResolvedValue(
            new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 })
        )
        const service = await BrevoEmailService.createEmailService(
            secrets({ BREVO_API_KEY: 'bad-key' })
        )

        await expect(service.sendVerificationEmail('123456', 'player@example.com')).rejects.toThrow(
            /Brevo: 401 .*Key not found/
        )
    })
})
