import type { DidCommInvitationType } from '../messages'

export enum DidCommOutOfBandRecordMetadataKeys {
  RecipientRouting = '_internal/recipientRouting',
  LegacyInvitation = '_internal/legacyInvitation',
  /** V2 OOB: persisted because v2Invitation is @Exclude() and lost on record load */
  V2Invitation = '_internal/v2Invitation',
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
    legacyInvitationType?: Exclude<DidCommInvitationType, DidCommInvitationType.OutOfBand>
  }
  [DidCommOutOfBandRecordMetadataKeys.V2Invitation]: Record<string, unknown> // DidCommOutOfBandInvitationV2.toJSON() - from/body survive serialization
}
