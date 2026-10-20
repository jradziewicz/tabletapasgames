import path from 'node:path'
import {
    GameService,
    LibraryService,
    CatalogService,
    CloudTasksTaskService,
    EmailService,
    FirestoreTokenStore,
    FirestoreUserStore,
    FirestoreSiteStatsStore,
    LocalTaskService,
    TaskService,
    SiteStatsService,
    TokenService,
    UserService,
    SecretsService,
    EnvSecretsService,
    FirestoreGameStore,
    NotificationService,
    PubSubService,
    DiscordService,
    FirestoreNotificationStore,
    DefaultNotificationService,
    DiscordTransport,
    DiscordWebhookTransport,
    WebPushTransport,
    EmailTransport,
    AblyTransport,
    AblyService,
    NullPubSubService,
    RedisPubSubService,
    RedisCacheService,
    RedisService,
    ChatService,
    FirestoreChatStore,
    ResendEmailService,
    PubSubTransport,
    EnvService,
    TournamentService,
    FirestoreTournamentStore,
    PreferenceService,
    FirestorePreferenceStore,
    BugReportService,
    FirestoreBugReportStore
} from '@tabletop/backend-services'
import type { GameDefinition } from '@tabletop/common'

import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
    interface FastifyInstance {
        taskService: TaskService
        tokenService: TokenService
        userService: UserService
        emailService: EmailService
        secretsService: SecretsService
        gameService: GameService
        notificationService: NotificationService
        discordWebhookTransport: DiscordWebhookTransport
        pubSubService: PubSubService
        discordService: DiscordService
        ablyService: AblyService
        chatService: ChatService
        cacheService: RedisCacheService
        libraryService: LibraryService
        catalogService: CatalogService
        tournamentService: TournamentService
        preferenceService: PreferenceService
        bugReportService: BugReportService
        siteStatsService: SiteStatsService
    }
}

const service: string = process.env['K_SERVICE'] ?? 'local'
const TASKS_HOST = process.env['TASKS_HOST'] ?? ''
const STATIC_ROOT = process.env['STATIC_ROOT'] ?? '.local-static'
const SITE_MANIFEST_PATH =
    process.env['SITE_MANIFEST_PATH'] ?? path.join(STATIC_ROOT, 'config', 'site-manifest.json')

const useAbly = !!process.env['ABLY_API_KEY']

export default fp(async (fastify: FastifyInstance) => {
    const secretsService = new EnvSecretsService()
    const emailService = await ResendEmailService.createEmailService(secretsService)
    const redisService = await RedisService.createRedisService(secretsService)
    fastify.addHook('onClose', async () => redisService.destroy())
    const redisCacheService = new RedisCacheService(redisService)
    fastify.addHook('onClose', async () => redisCacheService.destroy())

    const libraryService = new LibraryService(redisCacheService, {
        manifestPath: SITE_MANIFEST_PATH,
        allowFallback: EnvService.isLocal(),
        useCache: !EnvService.isLocal()
    })

    let availableTitles: Record<string, GameDefinition> = {}
    try {
        availableTitles = await libraryService.getTitlesMap()
    } catch (error) {
        console.warn('Unable to load game definitions from manifest', error)
    }

    const taskService: TaskService = EnvService.isLocal()
        ? new LocalTaskService(TASKS_HOST)
        : new CloudTasksTaskService(TASKS_HOST)
    const tokenService = new TokenService(new FirestoreTokenStore(fastify.firestore))
    const userStore = new FirestoreUserStore(
        redisCacheService,
        fastify.firestore,
        service === 'local'
    )
    const userService = new UserService(userStore, tokenService, taskService)

    let pubSubService: PubSubService = new NullPubSubService()
    if (!useAbly) {
        const redisPubSubService = await RedisPubSubService.createPubSubService(redisService)
        fastify.addHook('onClose', async () => redisPubSubService.destroy())
        pubSubService = redisPubSubService
    }

    const notificationStore = new FirestoreNotificationStore(redisCacheService, fastify.firestore)
    const notificationService = await DefaultNotificationService.createNotificationService(
        notificationStore,
        pubSubService
    )

    const gameStore = new FirestoreGameStore(redisCacheService, fastify.firestore)
    const gameService = new GameService(
        gameStore,
        userService,
        tokenService,
        taskService,
        notificationService,
        redisCacheService,
        availableTitles
    )

    fastify.decorate(
        'siteStatsService',
        new SiteStatsService(
            { games: gameStore, users: userStore, subscriptions: notificationStore },
            new FirestoreSiteStatsStore(fastify.firestore),
            taskService,
            redisCacheService
        )
    )

    // The site bot (DMs to linked accounts) only exists when a bot token is configured.
    let discordTransport: DiscordTransport | undefined
    if (process.env['DISCORD_BOT_TOKEN']) {
        discordTransport = await DiscordTransport.createDiscordTransport(
            secretsService,
            gameService
        )
        notificationService.addTransport(discordTransport)
    }
    const discordService = new DiscordService(notificationService, userService, discordTransport)

    // User-owned Discord webhooks need nothing from us (no bot token / OAuth app), so this is
    // always on. Kept on fastify too so the subscribe route can fire the "connected" test message.
    const discordWebhookTransport = new DiscordWebhookTransport(gameService)
    notificationService.addTransport(discordWebhookTransport)

    const webPushTransport = await WebPushTransport.createWebPushTransport(secretsService)
    notificationService.addTransport(webPushTransport)

    const emailTransport = new EmailTransport(
        emailService,
        userService,
        gameService,
        redisCacheService
    )
    notificationService.addTransport(emailTransport)

    if (useAbly) {
        const ablyTransport = await AblyTransport.createAblyTransport(secretsService)
        notificationService.addTopicTransport(ablyTransport)
        const ablyService = await AblyService.createAblyService(secretsService)
        fastify.decorate('ablyService', ablyService)
    } else {
        const pubSubTransport = new PubSubTransport(pubSubService)
        notificationService.addTopicTransport(pubSubTransport)
    }

    const chatService = new ChatService(
        gameService,
        new FirestoreChatStore(redisCacheService, fastify.firestore)
    )

    fastify.decorate('taskService', taskService)
    const tournamentService = new TournamentService(
        new FirestoreTournamentStore(redisCacheService, fastify.firestore),
        userService,
        availableTitles,
        notificationService,
        gameService,
        taskService
    )
    fastify.decorate('tournamentService', tournamentService)
    fastify.addHook('onClose', async () => {
        if (taskService instanceof LocalTaskService) taskService.close()
    })
    fastify.decorate('tokenService', tokenService)
    fastify.decorate('userService', userService)
    fastify.decorate('emailService', emailService)
    fastify.decorate('secretsService', secretsService)
    fastify.decorate('gameService', gameService)
    fastify.decorate('libraryService', libraryService)
    fastify.decorate('catalogService', new CatalogService(path.join(STATIC_ROOT, 'games')))
    fastify.decorate('pubSubService', pubSubService)
    fastify.decorate('notificationService', notificationService)
    fastify.decorate('discordWebhookTransport', discordWebhookTransport)
    fastify.decorate('discordService', discordService)
    fastify.decorate('chatService', chatService)
    fastify.decorate('cacheService', redisCacheService)
    fastify.decorate(
        'preferenceService',
        new PreferenceService(new FirestorePreferenceStore(fastify.firestore), redisCacheService)
    )
    fastify.decorate(
        'bugReportService',
        new BugReportService(gameService, new FirestoreBugReportStore(fastify.firestore))
    )
})
