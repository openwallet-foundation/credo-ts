export enum OutOfBandRecordMetadataKeys {
  RecipientRouting = '_internal/recipientRouting',
}

export type OutOfBandRecordMetadata = {
  [OutOfBandRecordMetadataKeys.RecipientRouting]: {
    recipientKeyFingerprint: string
    routingKeyFingerprints: string[]
    endpoints: string[]
    mediatorId?: string
  }
}
