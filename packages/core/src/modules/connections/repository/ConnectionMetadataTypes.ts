import type { ConnectionType } from '../models'

export enum ConnectionMetadataKeys {
  UseDidKeysForProtocol = '_internal/useDidKeysForProtocol',
  ConnectionTypes = '_internal/connectionTypes',
}

export type ConnectionMetadata = {
  [ConnectionMetadataKeys.UseDidKeysForProtocol]: {
    [protocolUri: string]: boolean
  }
  [ConnectionMetadataKeys.ConnectionTypes]: Array<ConnectionType | string>
}
