import type { DidCommConnectionStateChangedEvent } from '../DidCommConnectionEvents'

import { firstValueFrom } from 'rxjs'
import { filter, first, map, timeout } from 'rxjs/operators'

import { Agent } from '../../../../../core/src/agent/Agent'
import { DidsModule, PeerDidNumAlgo, createPeerDidDocumentFromServices } from '../../../../../core/src/modules/dids'
import { uuid } from '../../../../../core/src/utils/uuid'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions } from '../../../../../core/tests/helpers'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import { DidCommConnectionsModule } from '../DidCommConnectionsModule'
import { DidCommDidExchangeState } from '../models'

import { InMemoryDidRegistry } from './InMemoryDidRegistry'

function waitForRequest(agent: Agent, theirLabel: string) {
  return firstValueFrom(
    agent.events
      .observable<DidCommConnectionStateChangedEvent>(DidCommConnectionEventTypes.DidCommConnectionStateChanged)
      .pipe(
        map((event) => event.payload.connectionRecord),
        // Wait for request received
        filter(
          (connectionRecord) =>
            connectionRecord.state === DidCommDidExchangeState.RequestReceived &&
            connectionRecord.theirLabel === theirLabel
        ),
        first(),
        timeout(5000)
      )
  )
}

function waitForResponse(agent: Agent, connectionId: string) {
  return firstValueFrom(
    agent.events
      .observable<DidCommConnectionStateChangedEvent>(DidCommConnectionEventTypes.DidCommConnectionStateChanged)
      .pipe(
        // Wait for response received
        map((event) => event.payload.connectionRecord),
        filter(
          (connectionRecord) =>
            connectionRecord.state === DidCommDidExchangeState.ResponseReceived && connectionRecord.id === connectionId
        ),
        first(),
        timeout(5000)
      )
  )
}

describe('Did Exchange numalgo settings', () => {
  test('Connect using default setting (numalgo 1)', async () => {
    await didExchangeNumAlgoBaseTest({})
  })

  test('Connect using default setting for requester and numalgo 2 for responder', async () => {
    await didExchangeNumAlgoBaseTest({ responderNumAlgoSetting: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc })
  })

  test('Connect using numalgo 2 for requester and default setting for responder', async () => {
    await didExchangeNumAlgoBaseTest({ requesterNumAlgoSetting: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc })
  })

  test('Connect using numalgo 2 for both requester and responder', async () => {
    await didExchangeNumAlgoBaseTest({
      requesterNumAlgoSetting: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      responderNumAlgoSetting: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
    })
  })

  test('Connect using default setting for requester and numalgo 4 for responder', async () => {
    await didExchangeNumAlgoBaseTest({ responderNumAlgoSetting: PeerDidNumAlgo.ShortFormAndLongForm })
  })

  test('Connect using numalgo 4 for requester and default setting for responder', async () => {
    await didExchangeNumAlgoBaseTest({ requesterNumAlgoSetting: PeerDidNumAlgo.ShortFormAndLongForm })
  })

  test('Connect using numalgo 4 for both requester and responder', async () => {
    await didExchangeNumAlgoBaseTest({
      requesterNumAlgoSetting: PeerDidNumAlgo.ShortFormAndLongForm,
      responderNumAlgoSetting: PeerDidNumAlgo.ShortFormAndLongForm,
    })
  })

  test('Connect using an externally defined did for the requested', async () => {
    await didExchangeNumAlgoBaseTest({
      createExternalDidForRequester: true,
    })
  })
})

async function didExchangeNumAlgoBaseTest(options: {
  requesterNumAlgoSetting?: PeerDidNumAlgo
  responderNumAlgoSetting?: PeerDidNumAlgo
  createExternalDidForRequester?: boolean
}) {
  // Make a common in-memory did registry for both agents
  const didRegistry = new InMemoryDidRegistry()

  const aliceAgentOptions = getAgentOptions(
    'DID Exchange numalgo settings Alice',
    {
      endpoints: ['rxjs:alice'],
    },
    {},
    {
      connections: new DidCommConnectionsModule({
        autoAcceptConnections: false,
        peerNumAlgoForDidExchangeRequests: options.requesterNumAlgoSetting,
      }),
      dids: new DidsModule({ registrars: [didRegistry], resolvers: [didRegistry] }),
    },
    { requireDidcomm: true }
  )
  const faberAgentOptions = getAgentOptions(
    'DID Exchange numalgo settings Alice',
    {
      endpoints: ['rxjs:faber'],
    },
    {},
    {
      connections: new DidCommConnectionsModule({
        autoAcceptConnections: false,
        peerNumAlgoForDidExchangeRequests: options.responderNumAlgoSetting,
      }),
      dids: new DidsModule({ registrars: [didRegistry], resolvers: [didRegistry] }),
    },
    { requireDidcomm: true }
  )

  const aliceAgent = new Agent(aliceAgentOptions)
  const faberAgent = new Agent(faberAgentOptions)

  setupSubjectTransports([aliceAgent, faberAgent])
  await aliceAgent.initialize()
  await faberAgent.initialize()

  const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
    autoAcceptConnection: false,
    multiUseInvitation: false,
  })

  const waitForAliceRequest = waitForRequest(faberAgent, 'alice')

  let ourDid: string | undefined = undefined

  if (options.createExternalDidForRequester) {
    // Create did externally
    const didRouting = await aliceAgent.didcomm.mediationRecipient.getRouting({})
    ourDid = `did:inmemory:${uuid()}`
    const { didDocument, keys } = createPeerDidDocumentFromServices(
      [
        {
          id: 'didcomm',
          recipientKeys: [didRouting.recipientKey],
          routingKeys: didRouting.routingKeys,
          serviceEndpoint: didRouting.endpoints[0],
        },
      ],
      true
    )
    didDocument.id = ourDid

    await aliceAgent.dids.create({
      did: ourDid,
      didDocument,
      options: {
        keys,
      },
    })
  }

  let { connectionRecord: aliceConnectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
    faberOutOfBandRecord.outOfBandInvitation,
    {
      label: 'alice',
      autoAcceptInvitation: true,
      autoAcceptConnection: false,
      ourDid,
    }
  )

  let faberAliceConnectionRecord = await waitForAliceRequest

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const waitForAliceResponse = waitForResponse(aliceAgent, aliceConnectionRecord?.id!)

  await faberAgent.didcomm.connections.acceptRequest(faberAliceConnectionRecord.id)

  aliceConnectionRecord = await waitForAliceResponse
  await aliceAgent.didcomm.connections.acceptResponse(aliceConnectionRecord?.id)

  aliceConnectionRecord = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceConnectionRecord?.id)
  faberAliceConnectionRecord = await faberAgent.didcomm.connections.returnWhenIsConnected(
    faberAliceConnectionRecord?.id
  )

  expect(aliceConnectionRecord).toBeConnectedWith(faberAliceConnectionRecord)

  await aliceAgent.shutdown()

  await faberAgent.shutdown()
}
