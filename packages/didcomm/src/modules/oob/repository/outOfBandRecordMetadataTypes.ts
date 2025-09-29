import type { InvitationType } from '../messages'

export enum DidCommOutOfBandRecordMetadataKeys {
  RecipientRouting = '_internal/recipientRouting',
  LegacyInvitation = '_internal/legacyInvitation',
}

export type DidCommOutOfBandRecordMetadata = {
  [DidCommOutOfBandRecordMetadataKeys.RecipientRouting]: {
    recipientKeyFingerprint: string
    /**
     * Optional key id to use for the recipient key. If not configured the legacy base58 encoded public key will be used as the key id
     */
    recipientKeyId?: string
    routingKeyFingerprints: string[]
    endpoints: string[]
    mediatorId?: string
  }
  [DidCommOutOfBandRecordMetadataKeys.LegacyInvitation]: {
    /**
     * Indicates the type of the legacy invitation that was used for this out of band exchange.
     */
    legacyInvitationType?: Exclude<InvitationType, InvitationType.OutOfBand>
  }
}
