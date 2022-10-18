export enum ConnectionMetadataKeys {
  UseDidKeysForProtocol = '_internal/useDidKeysForProtocol',
}

export type ConnectionMetadata = {
  [ConnectionMetadataKeys.UseDidKeysForProtocol]: {
    [protocolUri: string]: boolean
  }
}
