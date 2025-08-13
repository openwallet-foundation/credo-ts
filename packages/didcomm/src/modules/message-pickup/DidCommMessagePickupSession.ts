import type { DidCommMessagePickupProtocolVersionType } from './DidCommMessagePickupApiOptions'
import type { DidCommMessagePickupProtocol } from './protocol/DidCommMessagePickupProtocol'

export enum DidCommMessagePickupSessionRole {
  Recipient = 'Recipient',
  MessageHolder = 'MessageHolder',
}
export type DidCommMessagePickupSession<MPPs extends DidCommMessagePickupProtocol[] = DidCommMessagePickupProtocol[]> =
  {
    id: string
    connectionId: string
    protocolVersion: DidCommMessagePickupProtocolVersionType<MPPs>
    role: DidCommMessagePickupSessionRole
  }
