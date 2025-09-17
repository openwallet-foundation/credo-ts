export enum DidCommConnectionMetadataKeys {
  UseDidKeysForProtocol = '_internal/useDidKeysForProtocol',
  DidRotate = '_internal/didRotate',
}

export type DidCommConnectionMetadata = {
  [DidCommConnectionMetadataKeys.UseDidKeysForProtocol]: {
    [protocolUri: string]: boolean
  }
  [DidCommConnectionMetadataKeys.DidRotate]: {
    did: string
    threadId: string
    mediatorId?: string
  }
}
