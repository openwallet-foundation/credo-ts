import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { DidCommService } from '../src/modules/connections/models/did/service'
import type { CredentialRecord } from '../src/modules/credentials'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'

import { getBaseConfig, prepareForIssuance } from './helpers'
import { TestLogger } from './logger'

import {
  AriesFrameworkError,
  AutoAcceptCredential,
  ConnectionState,
  CredentialPreview,
  CredentialState,
  IndyAgentService,
  LogLevel,
} from '@aries-framework/core' // Maybe it's not bad to import from package?

const faberConfig = getBaseConfig('Faber Agent OOB', {
  endpoints: ['rxjs:faber'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:faber'),
})
const aliceConfig = getBaseConfig('Alice Agent OOB', {
  endpoints: ['rxjs:alice'],
  logger: new TestLogger(LogLevel.debug, 'rxjs:alice'),
})

describe('out of band', () => {
  const makeConnectionOptions = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
  }

  const issueCredentialOptions = {
    goal: 'To issue a credential',
    goalCode: 'issue-vc',
    label: 'Faber College',
  }

  let faberAgent: Agent
  let aliceAgent: Agent
  let credDefId: string

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
    await aliceAgent.initialize()

    const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'profile_picture', 'x-ray'])
    credDefId = definition.id
  })

  afterAll(async () => {
    await faberAgent.shutdown({
      deleteWallet: true,
    })
    await aliceAgent.shutdown({
      deleteWallet: true,
    })
  })

  test('create OOB connection invitation', async () => {
    const { outOfBandMessage, connectionRecord } = await faberAgent.oob.createInvitation(makeConnectionOptions)

    // eslint-disable-next-line no-console
    console.log('outOfBandMessage.toJSON()', outOfBandMessage.toJSON())

    // expect supported handshake protocols
    expect(outOfBandMessage.handshakeProtocols).toContain('https://didcomm.org/connections/1.0')

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new IndyAgentService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    const createdConnectionRecord = await faberAgent.connections.findById(connectionRecord.id)
    expect((createdConnectionRecord?.didDoc.service[0] as DidCommService).recipientKeys).toEqual(service.recipientKeys)
    // TODO Should we also check routingKeys?
  })

  test('receive OOB connection invitation', async () => {
    const { outOfBandMessage } = await faberAgent.oob.createInvitation(makeConnectionOptions)

    const connectionRecord = await aliceAgent.oob.receiveInvitation(outOfBandMessage, { autoAccept: false })

    // expect contains services
    const [service] = outOfBandMessage.services
    expect(service).toMatchObject(
      new IndyAgentService({
        id: expect.any(String),
        serviceEndpoint: 'rxjs:faber',
        priority: 0,
        recipientKeys: [expect.any(String)],
        routingKeys: [],
      })
    )

    const createdConnectionRecord = await aliceAgent.connections.findById(connectionRecord.id)
    expect(createdConnectionRecord?.invitation?.serviceEndpoint).toEqual(service.serviceEndpoint)
    expect(createdConnectionRecord?.invitation?.recipientKeys).toEqual(service.recipientKeys)
    expect(createdConnectionRecord?.invitation?.routingKeys).toEqual(service.routingKeys)
    // TODO Should we also check routingKeys?
  })

  test('make a connection based on OOB invitation', async () => {
    // eslint-disable-next-line prefer-const
    let { outOfBandMessage, connectionRecord: faberAliceConnection } = await faberAgent.oob.createInvitation(
      makeConnectionOptions
    )

    let aliceFaberConnection = await aliceAgent.oob.receiveInvitation(outOfBandMessage, { autoAccept: true })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection.id)
    expect(aliceFaberConnection.state).toBe(ConnectionState.Complete)

    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection.id)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)

    expect(faberAliceConnection.state).toBe(ConnectionState.Complete)
  })

  test('throw an error when the OOB invitation contains requests', async () => {
    const { outOfBandMessage } = await faberAgent.oob.createInvitation(makeConnectionOptions)

    const credentialTemplate = {
      credentialDefinitionId: credDefId,
      preview: CredentialPreview.fromRecord({}),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)

    // Adding a request here should cause an error
    outOfBandMessage.addRequest(offerMessage)

    await expect(aliceAgent.oob.receiveInvitation(outOfBandMessage, { autoAccept: true })).rejects.toEqual(
      new AriesFrameworkError('OOB invitation contains unsupported `request~attach` attribute.')
    )
  })

  test('process credential offer requests based on OOB message', async () => {
    const credentialTemplate = {
      credentialDefinitionId: credDefId,
      preview: CredentialPreview.fromRecord({}),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const outOfBandMessage = await faberAgent.oob.createOobMessage(offerMessage, issueCredentialOptions)

    await aliceAgent.oob.receiveOobMessage(outOfBandMessage)

    let credentials: CredentialRecord[] = []
    while (credentials.length < 1) {
      credentials = await aliceAgent.credentials.getAll()
      await wait(100)
    }

    expect(credentials).toHaveLength(1)
    const [credential] = credentials
    expect(credential.state).toBe(CredentialState.OfferReceived)
  })

  test('throw an error when the OOB message contains handshake protocols', async () => {
    const credentialTemplate = {
      credentialDefinitionId: credDefId,
      preview: CredentialPreview.fromRecord({}),
      autoAcceptCredential: AutoAcceptCredential.Never,
    }
    const { offerMessage } = await faberAgent.credentials.createOutOfBandOffer(credentialTemplate)
    const outOfBandMessage = await faberAgent.oob.createOobMessage(offerMessage, issueCredentialOptions)

    // Adding a protocol here should cause an error
    outOfBandMessage.addHandshakeProtocol('https://didcomm.org/connections')

    await expect(aliceAgent.oob.receiveOobMessage(outOfBandMessage)).rejects.toEqual(
      new AriesFrameworkError('OOB message contains unsupported `handshake_protocols` attribute.')
    )
  })
})

function wait(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
