import { Kms } from '@credo-ts/core'
import { Agent } from '../../../../core/src/agent/Agent'
import { JsonEncoder } from '../../../../core/src/utils/JsonEncoder'
import { getAgentOptions } from '../../../../core/tests/helpers'
import { DidCommTrustPingMessage } from '../../modules/connections/messages'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from '../../modules/connections/models'
import { DidCommConnectionRecord } from '../../modules/connections/repository'
import { findOwnKeyAgreementKey, toKeyAgreementDidUrl } from '../../modules/connections/services/helpers'
import { DidCommV2Envelope } from '../DidCommV2Envelope'

describe('DidCommV2Envelope', () => {
  const agent = new Agent(
    getAgentOptions(
      'DidCommV2Envelope return route',
      { endpoints: ['rxjs:v2-envelope-return-route'], didcommVersions: ['v1', 'v2'] },
      undefined,
      undefined,
      { requireDidcomm: true }
    )
  )

  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  const createKeyAgreementDid = async () => {
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation({ didCommVersion: 'v2' })
    const did = outOfBandInvitation.v2Invitation?.from as string
    const { didDocument, keys } = await agent.dids.resolveCreatedDidDocumentWithKeys(did)
    const keyAgreement = findOwnKeyAgreementKey(didDocument, keys)
    if (!keyAgreement) throw new Error(`No keyAgreement key in ${did}`)
    return { did, ...keyAgreement }
  }

  it('answers a return route with a key of the current DID after our DID changed', async () => {
    const previous = await createKeyAgreementDid()
    const current = await createKeyAgreementDid()
    const peer = await createKeyAgreementDid()
    peer.publicJwk.keyId = peer.didUrl

    const connection = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Completed,
      did: current.did,
      theirDid: peer.did,
      didcommVersion: 'v2',
    })
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: peer.publicJwk,
      recipientKey: previous.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-1', to: [previous.did] },
      connection,
    })

    expect(keys.senderKey?.fingerprint).toBe(current.publicJwk.fingerprint)
    expect(keys.senderKeySkid).toBe(current.didUrl)

    const encrypted = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), keys, { connection })
    const { plaintextMessage } = await envelope.unpack(agent.context, encrypted)

    expect(JsonEncoder.fromBase64Url(encrypted.protected).skid).toBe(current.didUrl)
    expect(plaintextMessage.from).toBe(current.did)
  })

  it('keeps the addressed key when the current DID has no key on the peer curve', async () => {
    const current = await createKeyAgreementDid()
    const createP256Key = async () =>
      Kms.PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
    const addressedKey = await createP256Key()
    const peerKey = await createP256Key()

    const connection = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Completed,
      did: current.did,
      didcommVersion: 'v2',
    })
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: peerKey,
      recipientKey: addressedKey,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-3' },
      connection,
    })

    expect(keys.senderKey?.fingerprint).toBe(addressedKey.fingerprint)
    expect(keys.senderKeySkid).toBe(toKeyAgreementDidUrl(addressedKey))
  })

  it('sets from to the skid DID on a connectionless authcrypt message', async () => {
    const sender = await createKeyAgreementDid()
    const recipient = await createKeyAgreementDid()
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: recipient.publicJwk,
      recipientKey: sender.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-2' },
    })
    const encrypted = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), keys)
    const { plaintextMessage } = await envelope.unpack(agent.context, encrypted)

    const skid = JsonEncoder.fromBase64Url(encrypted.protected).skid
    expect(skid).toBe(keys.senderKeySkid)
    expect(plaintextMessage.from).toBe(skid.split('#')[0])
    expect(plaintextMessage.to).toBeUndefined()
  })
})
