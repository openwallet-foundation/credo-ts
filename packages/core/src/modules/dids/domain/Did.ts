import type { Transports } from '../../routing/types'

export enum DidType {
  Indy = 'Indy',
  KeyDid = 'KeyDid',
  PeerDid = 'PeerDid',
  WebDid = 'WebDid',
  Unknown = 'Unknown',
}

export enum DidMarker {
  Offline = 'offline',
  Online = 'online',
  Restricted = 'restricted',
}

export interface DidProps {
  seed?: string
  type?: DidType
  transports?: Transports[]
  marker?: DidMarker
  needMediation?: boolean
}
