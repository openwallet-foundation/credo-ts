import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { DidCommBasicMessageEventTypes, type DidCommModule, DidCommTrustPingEventTypes } from '../../didcomm/src'
import { NodeKeyManagementService } from '../../node/src'
import { Kms } from '../src'
import { Agent } from '../src/agent/Agent'
import { setupEventReplaySubjects } from './events'
import {
  getAgentOptions,
  makeConnection,
  waitForBasicMessageSubject,
  waitForTrustPingResponseReceivedEventSubject,
} from './helpers'
import { setupSubjectTransports } from './transport'

function createNodeKmsAgent(
  name: string,
  endpoint: string
): Agent<{ didcomm: DidCommModule; inMemory: InMemoryWalletModule }> {
  const options = getAgentOptions(
    name,
    {
      endpoints: [endpoint],
      didcommVersions: ['v1', 'v2'],
      connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )

  return new Agent({
    ...options,
    modules: { didcomm: options.modules.didcomm, inMemory: new InMemoryWalletModule() },
  })
}

describe('DIDComm v2 with only the node KMS', () => {
  const faberAgent = createNodeKmsAgent('Faber Node KMS v2', 'rxjs:faber-node-kms')
  const aliceAgent = createNodeKmsAgent('Alice Node KMS v2', 'rxjs:alice-node-kms')

  beforeEach(async () => {
    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  it('connects, round-trips a trust ping and exchanges basic messages', async () => {
    for (const agent of [faberAgent, aliceAgent]) {
      const { backends } = agent.dependencyManager.resolve(Kms.KeyManagementModuleConfig)
      expect(backends.map((kms) => kms.backend)).toEqual(['node'])
    }

    const encryptSpy = vi.spyOn(NodeKeyManagementService.prototype, 'encrypt')
    const decryptSpy = vi.spyOn(NodeKeyManagementService.prototype, 'decrypt')

    const [aliceReplay, faberReplay] = setupEventReplaySubjects(
      [aliceAgent, faberAgent],
      [
        DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent,
        DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
        DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged,
      ]
    )
    const [aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent, {
      didCommVersion: 'v2',
    })

    const ping = await aliceAgent.didcomm.connections.sendPing(aliceConnection.id, {})
    await waitForTrustPingResponseReceivedEventSubject(aliceReplay, { threadId: ping.threadId })

    await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, 'alice to faber')
    await waitForBasicMessageSubject(faberReplay, { content: 'alice to faber' })
    await faberAgent.didcomm.basicMessages.sendMessage(faberConnection.id, 'faber to alice')
    await waitForBasicMessageSubject(aliceReplay, { content: 'faber to alice' })

    const authcryptEncrypts = encryptSpy.mock.calls
      .map(([, options]) => options)
      .filter((options) => options.key.keyAgreement?.algorithm === 'ECDH-1PU+A256KW')
    const authcryptDecrypts = decryptSpy.mock.calls
      .map(([, options]) => options)
      .filter((options) => options.key.keyAgreement?.algorithm === 'ECDH-1PU+A256KW')

    expect(authcryptEncrypts.length).toBeGreaterThanOrEqual(4)
    expect(authcryptDecrypts.length).toBeGreaterThanOrEqual(4)
    for (const options of authcryptEncrypts) {
      expect(options).toMatchObject({
        encryption: { algorithm: 'A256CBC-HS512' },
        key: { keyAgreement: { externalPublicJwk: { crv: 'X25519' } } },
      })
    }
    expect(decryptSpy.mock.settledResults.map((result) => result.type)).not.toContain('rejected')
  })
})
