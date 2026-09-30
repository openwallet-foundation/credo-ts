import {
  DidCommConnectionService,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
  DidCommMessageReceiver,
  DidCommV2EnvelopeService,
  type DidCommV2PlaintextMessage,
} from '../../didcomm/src'
import {
  DidDocumentBuilder,
  didDocumentToNumAlgo2Did,
  getEd25519VerificationKey2018,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
} from '../src'
import { Agent } from '../src/agent/Agent'
import { JsonEncoder } from '../src/utils/JsonEncoder'
import { getAgentOptions, waitForTrustPingResponseReceivedEvent } from './helpers'
import { setupSubjectTransports } from './transport'

type EncryptedEnvelope = { protected: string; recipients: Array<{ header: { kid: string } }> }
type ProtectedHeader = { alg: string; skid?: string; epk: { crv: string } }

describe.each(['X25519', 'P-256', 'P-384'] as const)('DIDComm v2 key ids over %s', (curve) => {
  const endpointSuffix = curve.toLowerCase().replace('-', '')
  const createAgent = (name: string) =>
    new Agent(
      getAgentOptions(
        `${name} DIDComm v2 key ids ${curve}`,
        {
          endpoints: [`rxjs:${name.toLowerCase()}-key-ids-${endpointSuffix}`],
          didcommVersions: ['v1', 'v2'],
          v2KeyAgreementCurve: curve,
          connections: { autoAcceptConnections: true, autoCreateConnectionOnFirstMessage: true },
        },
        undefined,
        undefined,
        { requireDidcomm: true }
      )
    )

  let faberAgent: ReturnType<typeof createAgent>
  let aliceAgent: ReturnType<typeof createAgent>

  beforeEach(async () => {
    faberAgent = createAgent('Faber')
    aliceAgent = createAgent('Alice')
    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  it('puts keyAgreement DID URLs in skid and recipient kid', async () => {
    const receiveSpy = vi.spyOn(DidCommMessageReceiver.prototype, 'receiveMessage')
    const packSpy = vi.spyOn(DidCommV2EnvelopeService.prototype, 'pack')

    const invAlice = await aliceAgent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const aliceDid = invAlice.outOfBandInvitation.v2Invitation?.from as string
    const { connectionRecord: faberConn0, outOfBandRecord: faberOob0 } = await faberAgent.didcomm.oob.receiveInvitation(
      invAlice.outOfBandInvitation,
      { label: '' }
    )
    const faberConnId =
      faberConn0?.id ?? (await faberAgent.didcomm.connections.findAllByOutOfBandId(faberOob0.id))[0]?.id
    const faberConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberConnId as string, {
      timeoutMs: 20000,
    })

    const invFaber = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
      ourDid: faberConnection.did,
    })
    const { connectionRecord: aliceConn0, outOfBandRecord: aliceOob0 } = await aliceAgent.didcomm.oob.receiveInvitation(
      invFaber.outOfBandInvitation,
      { label: '', ourDid: aliceDid }
    )
    const aliceConnId =
      aliceConn0?.id ?? (await aliceAgent.didcomm.connections.findAllByOutOfBandId(aliceOob0.id))[0]?.id
    const aliceConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceConnId as string, {
      timeoutMs: 20000,
    })

    const ping = await aliceAgent.didcomm.connections.sendPing(aliceConnection.id, {})
    await waitForTrustPingResponseReceivedEvent(aliceAgent, { threadId: ping.threadId })

    const authcrypt = receiveSpy.mock.calls
      .map(([message]) => message as EncryptedEnvelope)
      .filter((message) => typeof message.protected === 'string')
      .map((message) => ({ message, header: JsonEncoder.fromBase64Url(message.protected) as ProtectedHeader }))
      .filter(({ header }) => header.alg === 'ECDH-1PU+A256KW')

    expect(authcrypt.length).toBeGreaterThan(0)
    for (const { message, header } of authcrypt) {
      expect(header.epk.crv).toBe(curve)

      for (const kid of [header.skid as string, ...message.recipients.map((recipient) => recipient.header.kid)]) {
        expect(kid).toMatch(/^did:[^#]+#.+$/)
        const didDocument = await faberAgent.dids.resolveDidDocument(kid.split('#')[0])
        expect(didDocument.dereferenceKey(kid, ['keyAgreement'])).toBeDefined()
      }
    }

    const addressed = packSpy.mock.calls
      .map(([, plaintext, keys]) => ({ plaintext: plaintext as DidCommV2PlaintextMessage, keys }))
      .filter(({ plaintext }) => plaintext.to !== undefined)
    expect(addressed.length).toBeGreaterThan(0)
    for (const { plaintext, keys } of addressed) {
      expect(keys.senderKeySkid.split('#')[0]).toBe(plaintext.from)
      expect(plaintext.to).toContain(keys.recipientKid.split('#')[0])
    }
  }, 30000)

  it('does not encrypt to an Ed25519 keyAgreement key of a v2 peer', async () => {
    const packSpy = vi.spyOn(DidCommV2EnvelopeService.prototype, 'pack')
    const { id: outOfBandId, outOfBandInvitation } = await faberAgent.didcomm.oob.createInvitation({
      didCommVersion: 'v2',
    })
    const { publicJwk } = await aliceAgent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const theirDid = didDocumentToNumAlgo2Did(
      new DidDocumentBuilder('')
        .addKeyAgreement(
          getEd25519VerificationKey2018({
            id: '#key-1',
            publicJwk: Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
            controller: '#id',
          })
        )
        .addService(
          new NewDidCommV2Service({
            id: '#didcommmessaging-0',
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              uri: `rxjs:alice-key-ids-${endpointSuffix}`,
              accept: ['didcomm/v2'],
            }),
          })
        )
        .build()
    )
    const connection = await faberAgent.dependencyManager
      .resolve(DidCommConnectionService)
      .createConnection(faberAgent.context, {
        protocol: DidCommHandshakeProtocol.None,
        role: DidCommDidExchangeRole.Requester,
        state: DidCommDidExchangeState.Completed,
        did: outOfBandInvitation.v2Invitation?.from,
        theirDid,
        outOfBandId,
        didcommVersion: 'v2',
      })

    // Whether the send then fails or falls back to v1 does not matter here
    await faberAgent.didcomm.connections.sendPing(connection.id, {}).catch(() => undefined)
    expect(packSpy).not.toHaveBeenCalled()
  })
})
