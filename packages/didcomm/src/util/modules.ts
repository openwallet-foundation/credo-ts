import { DidCommModule } from '../DidCommModule'
import {
  ConnectionsModule,
  CredentialsModule,
  ProofsModule,
  MediatorModule,
  DiscoverFeaturesModule,
  MediationRecipientModule,
  MessagePickupModule,
  BasicMessagesModule,
  OutOfBandModule,
} from '../modules'

export function getDefaultDidcommModules() {
  return {
    connections: () => new ConnectionsModule(),
    credentials: () => new CredentialsModule(),
    proofs: () => new ProofsModule(),
    mediator: () => new MediatorModule(),
    discovery: () => new DiscoverFeaturesModule(),
    mediationRecipient: () => new MediationRecipientModule(),
    messagePickup: () => new MessagePickupModule(),
    basicMessages: () => new BasicMessagesModule(),
    didcomm: () => new DidCommModule(),
    oob: () => new OutOfBandModule(),
  } as const
}
