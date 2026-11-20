import type { Kms } from '@credo-ts/core'

export enum DidCommConnectionMetadataKeys {
  UseDidKeysForProtocol = '_internal/useDidKeysForProtocol',
  DidRotate = '_internal/didRotate',
  DidRotateV2 = '_internal/didRotateV2',
  OutOfBandV2ParentThreadId = '_internal/outOfBandV2ParentThreadId',
  SharedDid = '_internal/sharedDid',
  CreatedKeys = '_internal/createdKeys',
}

/**
 * The DIDs and KMS keys Credo created for a connection or out-of-band record. Only these are deleted with the record.
 */
export type DidCommCreatedKeys = {
  dids: string[]
  keys: DidCommCreatedKey[]
}

/**
 * A created KMS key with its public jwk (without `kid`), so deleting it doesn't need to fetch it from the KMS.
 */
export type DidCommCreatedKey = Kms.KmsKeyReference & {
  publicJwk: Kms.KmsJwkPublicAsymmetric
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
  [DidCommConnectionMetadataKeys.SharedDid]: {
    dids: string[]
  }
  [DidCommConnectionMetadataKeys.CreatedKeys]: DidCommCreatedKeys
}
