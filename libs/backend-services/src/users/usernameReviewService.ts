import {
    isInappropriateUsername,
    UsernameReview,
    UsernameReviewRequest,
    UsernameReviewStatus
} from '@tabletop/common'
import { CollectionReference, Firestore, Timestamp } from '@google-cloud/firestore'
import { nanoid } from 'nanoid'
import { NotFoundError } from '../persistence/stores/errors.js'

// Requests from people whose username was blocked by the username filter
// (isInappropriateUsername), listed on the Admin page. Approving one adds the name to
// allowedUsernames/{lowercased name}, which UserService checks before refusing a name.
export class UsernameReviewService {
    private readonly reviews: CollectionReference
    private readonly allowedUsernames: CollectionReference

    constructor(firestore: Firestore) {
        this.reviews = firestore.collection('usernameReviews')
        this.allowedUsernames = firestore.collection('allowedUsernames')
    }

    async submit(
        request: UsernameReviewRequest,
        requester?: { id: string; email?: string }
    ): Promise<void> {
        const username = request.username.trim()
        // Only names the filter actually blocks are worth an admin's time.
        if (!isInappropriateUsername(username) || (await this.isApproved(username))) {
            return
        }
        const id = nanoid()
        const review: UsernameReview = {
            id,
            username,
            status: UsernameReviewStatus.Open,
            createdAt: new Date(),
            ...(request.note?.trim() ? { note: request.note.trim() } : {}),
            ...(requester ? { requesterId: requester.id } : {}),
            ...(requester?.email ? { requesterEmail: requester.email } : {})
        }
        await this.reviews.doc(id).create(review)
    }

    async list(status?: UsernameReviewStatus): Promise<UsernameReview[]> {
        const query = status ? this.reviews.where('status', '==', status) : this.reviews
        const snapshot = await query.get()
        return snapshot.docs
            .map((doc) => fromStored(doc.data()))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    async setStatus(id: string, status: UsernameReviewStatus): Promise<UsernameReview> {
        const doc = this.reviews.doc(id)
        const snapshot = await doc.get()
        if (!snapshot.exists) {
            throw new NotFoundError({ type: 'UsernameReview', id })
        }
        const review = fromStored(snapshot.data()!)
        const resolvedAt = new Date()
        await doc.update({ status, resolvedAt })
        if (status === UsernameReviewStatus.Approved) {
            await this.allowedUsernames
                .doc(encodeURIComponent(review.username.toLowerCase()))
                .set({ username: review.username, approvedAt: resolvedAt })
        } else {
            await this.allowedUsernames.doc(encodeURIComponent(review.username.toLowerCase())).delete()
        }
        return { ...review, status, resolvedAt }
    }

    async isApproved(username: string): Promise<boolean> {
        const snapshot = await this.allowedUsernames
            .doc(encodeURIComponent(username.trim().toLowerCase()))
            .get()
        return snapshot.exists
    }
}

function fromStored(data: Record<string, unknown>): UsernameReview {
    const review = { ...data } as unknown as UsernameReview
    review.createdAt = (data.createdAt as Timestamp).toDate()
    if (data.resolvedAt) review.resolvedAt = (data.resolvedAt as Timestamp).toDate()
    return review
}
