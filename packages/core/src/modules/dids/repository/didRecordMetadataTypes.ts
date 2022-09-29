export enum DidRecordMetadataKeys {
  LegacyDid = '_internal/legacyDid',
}

export type DidRecordMetadata = {
  [DidRecordMetadataKeys.LegacyDid]: {
    unqualifiedDid: string
    didDocumentString: string
  }
}
