export enum DidCommConnectionMetadataKeys {
  UseDidKeysForProtocol = '_internal/useDidKeysForProtocol',
  DidRotate = '_internal/didRotate',
  DidRotateV2 = '_internal/didRotateV2',
  OutOfBandV2ParentThreadId = '_internal/outOfBandV2ParentThreadId',
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
  [DidCommConnectionMetadataKeys.DidRotateV2]: {
    fromPriorJwt: string
    priorDid: string
    newDid: string
  }
  [DidCommConnectionMetadataKeys.OutOfBandV2ParentThreadId]: {
    parentThreadId: string
  }
}
