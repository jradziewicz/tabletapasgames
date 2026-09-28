import { PubSubService, PubSubSubscriber } from '../pubsub/pubSubService.js'
import {
    Notification,
    NotificationCategory,
    UserNotification,
    UserNotificationAction
} from '@tabletop/common'
import { NotificationStore } from '../persistence/stores/notificationStore.js'
import {
    NotificationDistributionMethod,
    NotificationListener,
    NotificationService
} from './notificationService.js'
import { NotificationTransport, TransportType } from './transports/notificationTransport.js'
import { NotificationSubscription } from './subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from './subscriptions/notificationSubscriptionIdentifier.js'
import { TopicTransport } from './transports/topicTransport.js'

export class DefaultNotificationService implements NotificationService {
    private transports: Record<string, NotificationTransport> = {}
    private topicTransports: Record<string, TopicTransport> = {}

    // For internal topic listeners... where we proxy the messages to the listeners via SSE or whatnot
    private rtListenersById: Record<string, NotificationListener> = {}
    private rtListenersByTopic: Record<string, Set<string>> = {}

    private pubSubSubscriber: PubSubSubscriber = {
        id: 'notifications-service', // Need better id probably
        onMessage: async ({ message, topic }) => {
            await this.notifyTopicListeners({ topic, notification: message })
        }
    }

    private constructor(
        private readonly notificationStore: NotificationStore,
        private readonly pubSubService: PubSubService
    ) {}

    static async createNotificationService(
        notificationStore: NotificationStore,
        pubSubService: PubSubService
    ): Promise<NotificationService> {
        const service = new DefaultNotificationService(notificationStore, pubSubService)
        await service.initialize()
        return service
    }

    private async initialize(): Promise<void> {
        await this.pubSubService.subscribeToTopics({
            topics: ['global'],
            subscriber: this.pubSubSubscriber
        })
        await this.pubSubService.subscribeToTopicPatterns({
            topics: ['user-*', 'game-*'],
            subscriber: this.pubSubSubscriber
        })
    }

    addTransport(transport: NotificationTransport) {
        this.transports[transport.type] = transport
    }

    addTopicTransport(transport: TopicTransport) {
        this.topicTransports[transport.type] = transport
    }

    async addTopicListener({ listener, topic }: { listener: NotificationListener; topic: string }) {
        this.rtListenersById[listener.id] = listener

        if (!this.rtListenersByTopic[topic]) {
            this.rtListenersByTopic[topic] = new Set()
        }
        this.rtListenersByTopic[topic].add(listener.id)
    }

    async removeTopicListener({ listenerId }: { listenerId: string }) {
        const listener = this.rtListenersById[listenerId]
        if (!listener) {
            return
        }

        for (const topic of Object.keys(this.rtListenersByTopic)) {
            this.rtListenersByTopic[topic].delete(listenerId)
        }

        delete this.rtListenersById[listenerId]
    }

    async sendNotification({
        notification,
        topics,
        channels
    }: {
        notification: Notification
        topics: string[]
        channels: NotificationDistributionMethod[]
    }) {
        for (const topic of topics) {
            if (channels.includes(NotificationDistributionMethod.Topical)) {
                for (const topicTransport of Object.values(this.topicTransports)) {
                    topicTransport.sendNotification({ notification, topic }).catch((e) => {
                        console.log('Error sending topical notification', e)
                    })
                }
            }

            if (channels.includes(NotificationDistributionMethod.UserDirect)) {
                const alertStage = this.turnAlertStage(notification)

                // Fetched once and reused below: it drives which registered subscriptions
                // (push/Discord bot/Discord webhook) get dispatched to, and also - for the
                // 5-minute turn alert - whether this user has a Discord webhook configured,
                // in which case the email below is held off.
                let subscriptions: NotificationSubscription[] = []
                try {
                    subscriptions = await this.notificationStore.findNotificationSubscriptions(topic)
                } catch (e) {
                    console.log('Error fetching notification subscriptions', e)
                }

                try {
                    // The 5-minute turn alert exists only for email; push/Discord already
                    // pinged at the 1-minute mark, so don't double them up here.
                    const subscriptionsToNotify = alertStage === 'email' ? [] : subscriptions

                    for (const subscription of subscriptionsToNotify) {
                        const transport = this.transports[subscription.transport]
                        if (!transport) {
                            console.log('No transport found for', subscription.transport)
                            continue
                        }
                        transport
                            .sendNotification(structuredClone(subscription), notification)
                            .then(async (result) => {
                                if (result.unregister) {
                                    await this.notificationStore.deleteNotificationSubscription(
                                        subscription
                                    )
                                }
                            })
                            .catch((e) => {
                                console.log('Error sending web push notification', e)
                            })
                    }
                } catch (e) {
                    console.log('Error sending notification', e)
                }

                // Email is treated as an always-available channel, unlike Discord and
                // WebPush which require the user to explicitly register a subscription
                // (linking their Discord account, or granting browser push permission).
                // Every user already has a registered email address from sign up, so
                // there's nothing to opt into here and no persisted subscription record
                // to look up - we dispatch straight to the email transport, keyed off the
                // user id embedded in the notification itself, if one is registered.
                //
                // Exception: once a player has a Discord webhook configured, the 5-minute
                // "it's your turn" email is redundant with the webhook ping they already got
                // at the 1-minute mark, so it's skipped. The 24-hour-and-later "reminder"
                // stage still emails everyone regardless of webhook status - if a full day
                // has passed and the player still hasn't moved, the webhook may not be
                // getting through (deleted webhook, muted channel, etc.), so email comes
                // back as a safety net.
                const hasWebhookSubscription = subscriptions.some(
                    (subscription) => subscription.transport === TransportType.DiscordWebhook
                )
                const emailTransport = this.transports[TransportType.Email]
                // Email skips the quick 1-minute nudge and starts at the 5-minute mark.
                if (
                    emailTransport &&
                    this.isUserNotification(notification) &&
                    alertStage !== 'initial' &&
                    !(alertStage === 'email' && hasWebhookSubscription)
                ) {
                    const emailSubscription: NotificationSubscription = {
                        id: notification.data.user.id,
                        transport: TransportType.Email
                    }
                    emailTransport
                        .sendNotification(emailSubscription, notification)
                        .catch((e) => {
                            console.log('Error sending email notification', e)
                        })
                }
            }
        }
    }

    async registerNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }) {
        await this.notificationStore.upsertNotificationSubscription({ subscription, topic })
    }

    async unregisterNotificationSubscription(identifier: NotificationSubscriptionIdentifier) {
        await this.notificationStore.deleteNotificationSubscription(identifier)
    }

    async findNotificationSubscriptions(topic: string): Promise<NotificationSubscription[]> {
        return await this.notificationStore.findNotificationSubscriptions(topic)
    }

    private async notifyTopicListeners({
        topic,
        notification
    }: {
        topic: string
        notification: string
    }) {
        const listeners = Array.from(this.rtListenersByTopic[topic] || new Set())
            .map((id) => this.rtListenersById[id])
            .filter((listener) => listener)

        for (const listener of listeners) {
            try {
                await listener.onMessage({ message: notification, topic })
            } catch (e) {
                // log error
            }
        }
    }

    private isUserNotification(notification: Notification): notification is UserNotification {
        return notification.type === NotificationCategory.User
    }

    private turnAlertStage(notification: Notification): string | undefined {
        if (
            this.isUserNotification(notification) &&
            notification.action === UserNotificationAction.IsYourTurn
        ) {
            return notification.data.alertStage
        }
        return undefined
    }
}
