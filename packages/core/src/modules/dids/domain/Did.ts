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
}

export interface DidProps {
  seed?: string
  type?: DidType
  transports?: Transports[]
  marker?: DidMarker
}
