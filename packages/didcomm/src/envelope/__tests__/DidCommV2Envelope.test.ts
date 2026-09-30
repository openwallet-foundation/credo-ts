import {
  DidDocumentBuilder,
  didDocumentToNumAlgo2Did,
  getEd25519VerificationKey2018,
  Kms,
  TypedArrayEncoder,
  utils,
} from '@credo-ts/core'
import { Agent } from '../../../../core/src/agent/Agent'
import { JsonEncoder } from '../../../../core/src/utils/JsonEncoder'
import { getAgentOptions } from '../../../../core/tests/helpers'
import { DidCommTrustPingMessage } from '../../modules/connections/messages'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from '../../modules/connections/models'
import { DidCommConnectionRecord } from '../../modules/connections/repository'
import {
  findOwnKeyAgreementKey,
  toAbsoluteDidUrl,
  toKeyAgreement,
  toKeyAgreementDidUrl,
} from '../../modules/connections/services/helpers'
import { type DidCommV2EncryptedMessage, DidCommV2EnvelopeService, type DidCommV2PlaintextMessage } from '../../v2'
import { computeApu, computeApv } from '../../v2/apuApv'
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

  it('names the created DID that holds the addressed key in a connectionless return route reply', async () => {
    const ours = await createKeyAgreementDid()
    const peer = await createKeyAgreementDid()
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)
    const inbound = await agent.dependencyManager.resolve(DidCommV2EnvelopeService).pack(
      agent.context,
      { id: utils.uuid(), type: DidCommTrustPingMessage.type.messageTypeUri, from: peer.did, to: [ours.did] },
      {
        senderKey: peer.publicJwk,
        senderKeySkid: peer.didUrl,
        recipientKey: ours.publicJwk,
        recipientKid: ours.didUrl,
      }
    )
    const { plaintextMessage, senderKey, recipientKey } = await envelope.unpack(agent.context, inbound)
    if (!senderKey) throw new Error('Expected an authcrypt sender key')

    const keys = await envelope.buildReturnRouteKeys(agent.context, { senderKey, recipientKey, plaintextMessage })
    const reply = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), keys)
    const { plaintextMessage: replyPlaintext, authenticatedSenderDid } = await envelope.unpack(agent.context, reply)

    expect(JsonEncoder.fromBase64Url(reply.protected).skid).toBe(ours.didUrl)
    expect(replyPlaintext.from).toBe(ours.did)
    expect(authenticatedSenderDid).toBe(ours.did)
  })

  it('sets from to the skid DID on a return route reply over a connection without theirDid', async () => {
    const current = await createKeyAgreementDid()
    const peer = await createKeyAgreementDid()
    peer.publicJwk.keyId = peer.didUrl

    const connection = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Responder,
      state: DidCommDidExchangeState.Completed,
      did: current.did,
      didcommVersion: 'v2',
    })
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: peer.publicJwk,
      recipientKey: current.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-4' },
      connection,
    })
    const encrypted = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), keys, { connection })
    const { plaintextMessage, authenticatedSenderDid } = await envelope.unpack(agent.context, encrypted)

    const skidDid = JsonEncoder.fromBase64Url(encrypted.protected).skid.split('#')[0]
    expect(plaintextMessage.from).toBe(skidDid)
    expect(authenticatedSenderDid).toBe(skidDid)
  })

  it('sets from to the skid DID when return route keys predate a rotation of our DID', async () => {
    const previous = await createKeyAgreementDid()
    const current = await createKeyAgreementDid()
    const peer = await createKeyAgreementDid()
    peer.publicJwk.keyId = peer.didUrl

    const connection = new DidCommConnectionRecord({
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Completed,
      did: previous.did,
      theirDid: peer.did,
      didcommVersion: 'v2',
    })
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: peer.publicJwk,
      recipientKey: previous.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-6', to: [previous.did] },
      connection,
    })
    connection.did = current.did

    const encrypted = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), keys, { connection })
    const { plaintextMessage, authenticatedSenderDid } = await envelope.unpack(agent.context, encrypted)

    expect(plaintextMessage.from).toBe(previous.did)
    expect(authenticatedSenderDid).toBe(previous.did)
  })

  it('does not pack v2 without a sender skid', async () => {
    const sender = await createKeyAgreementDid()
    const recipient = await createKeyAgreementDid()
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)
    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: recipient.publicJwk,
      recipientKey: sender.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-5' },
    })

    expect(envelope.supportsPacking(keys)).toBe(true)
    expect(envelope.supportsPacking({ ...keys, senderKeySkid: undefined })).toBe(false)
  })

  it('encrypts to the recipient key on the sender curve when it is not the first recipient key', async () => {
    const sender = await createKeyAgreementDid()
    const recipient = await createKeyAgreementDid()
    recipient.publicJwk.keyId = recipient.didUrl
    const p256Key: Kms.PublicJwk = Kms.PublicJwk.fromPublicJwk(
      (await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
    )
    const envelope = agent.dependencyManager.resolve(DidCommV2Envelope)

    const keys = await envelope.buildReturnRouteKeys(agent.context, {
      senderKey: recipient.publicJwk,
      recipientKey: sender.publicJwk,
      plaintextMessage: { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'ping-7' },
    })

    const encrypted = await envelope.pack(agent.context, new DidCommTrustPingMessage({}), {
      ...keys,
      recipientKeys: [p256Key as Kms.PublicJwk<Kms.Ed25519PublicJwk>, ...keys.recipientKeys],
    })
    const { authenticatedSenderDid } = await envelope.unpack(agent.context, encrypted)

    expect((encrypted as DidCommV2EncryptedMessage).recipients[0].header.kid).toBe(recipient.didUrl)
    expect(authenticatedSenderDid).toBe(sender.did)
  })

  describe('authcrypt sender binding', () => {
    const packAuthcrypt = async (
      plaintext: Omit<DidCommV2PlaintextMessage, 'id' | 'type'>,
      sender: Awaited<ReturnType<typeof createKeyAgreementDid>>,
      recipient: Awaited<ReturnType<typeof createKeyAgreementDid>>
    ) =>
      agent.dependencyManager.resolve(DidCommV2EnvelopeService).pack(
        agent.context,
        { id: utils.uuid(), type: DidCommTrustPingMessage.type.messageTypeUri, ...plaintext },
        {
          senderKey: sender.publicJwk,
          senderKeySkid: sender.didUrl,
          recipientKey: recipient.publicJwk,
          recipientKid: recipient.didUrl,
        }
      )

    // Mirrors DidCommV2EnvelopeService.pack so a test can set headers pack never emits
    const packAuthcryptWithHeaders = async ({
      sender,
      recipient,
      skid,
      apuSkid = sender.didUrl,
      enc,
    }: {
      sender: Awaited<ReturnType<typeof createKeyAgreementDid>>
      recipient: Awaited<ReturnType<typeof createKeyAgreementDid>>
      skid?: string
      apuSkid?: string
      enc: 'A256CBC-HS512' | 'A256GCM'
    }): Promise<DidCommV2EncryptedMessage> => {
      const apu = computeApu(apuSkid)
      const apv = computeApv([recipient.didUrl])
      const ephemeralKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      const protectedHeader = JsonEncoder.toBase64Url({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-1PU+A256KW',
        enc,
        ...(skid ? { skid } : {}),
        apu: TypedArrayEncoder.toBase64Url(apu),
        apv: TypedArrayEncoder.toBase64Url(apv),
        epk: { kty: 'OKP', crv: 'X25519', x: (ephemeralKey.publicJwk as Kms.KmsJwkPublicOkp).x },
      })
      const { encrypted, iv, tag, encryptedKey } = await agent.kms.encrypt({
        key: {
          keyAgreement: {
            algorithm: 'ECDH-1PU+A256KW',
            keyId: sender.publicJwk.keyId,
            ephemeralKeyId: ephemeralKey.keyId,
            externalPublicJwk: recipient.publicJwk.toJson() as Kms.KmsJwkPublicEcdh,
            apu,
            apv,
          },
        },
        encryption: { algorithm: enc, aad: TypedArrayEncoder.fromUtf8String(protectedHeader) },
        data: JsonEncoder.toUint8Array({
          id: utils.uuid(),
          type: DidCommTrustPingMessage.type.messageTypeUri,
          from: sender.did,
          to: [recipient.did],
        }),
      })
      if (!iv || !tag || !encryptedKey) throw new Error('Expected iv, tag and encrypted key from KMS encrypt')

      return {
        protected: protectedHeader,
        recipients: [
          { header: { kid: recipient.didUrl }, encrypted_key: TypedArrayEncoder.toBase64Url(encryptedKey.encrypted) },
        ],
        iv: TypedArrayEncoder.toBase64Url(iv),
        ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
        tag: TypedArrayEncoder.toBase64Url(tag),
      }
    }

    it('recovers the sender from apu when skid is absent', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const encrypted = await packAuthcryptWithHeaders({ sender, recipient, enc: 'A256CBC-HS512' })

      const { plaintextMessage, authenticatedSenderDid } = await agent.dependencyManager
        .resolve(DidCommV2Envelope)
        .unpack(agent.context, encrypted)

      expect(plaintextMessage.from).toBe(sender.did)
      expect(authenticatedSenderDid).toBe(sender.did)
    })

    it('rejects a skid that does not match apu', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const victim = await createKeyAgreementDid()
      const encrypted = await packAuthcryptWithHeaders({ sender, recipient, skid: victim.didUrl, enc: 'A256CBC-HS512' })

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        'apu in protected header does not match skid'
      )
    })

    it.each([
      { case: 'skid', inSkid: true },
      { case: 'apu with no skid', inSkid: false },
    ])('rejects a local KMS key id as the sender in $case', async ({ inSkid }) => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const kmsKeyId = sender.publicJwk.keyId
      const encrypted = await packAuthcryptWithHeaders({
        sender,
        recipient,
        skid: inSkid ? kmsKeyId : undefined,
        apuSkid: kmsKeyId,
        enc: 'A256CBC-HS512',
      })

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        'Could not resolve sender key for skid'
      )
    })

    it('rejects authcrypt with A256GCM content encryption', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const encrypted = await packAuthcryptWithHeaders({ sender, recipient, skid: sender.didUrl, enc: 'A256GCM' })

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        'requires A256CBC-HS512 content encryption, got A256GCM'
      )
    })

    it('binds a message without from to the skid DID', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const encrypted = await packAuthcrypt({ to: [recipient.did] }, sender, recipient)

      const { authenticatedSenderDid } = await agent.dependencyManager
        .resolve(DidCommV2Envelope)
        .unpack(agent.context, encrypted)

      expect(authenticatedSenderDid).toBe(sender.didUrl.split('#')[0])
    })

    it('rejects a from that does not match the skid DID', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const victim = await createKeyAgreementDid()
      const encrypted = await packAuthcrypt({ from: victim.did, to: [recipient.did] }, sender, recipient)

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        /plaintext 'from' .* does not match the authcrypt sender/
      )
    })

    it('rejects a sender whose keyAgreement key is Ed25519', async () => {
      const recipient = await createKeyAgreementDid()
      const { keyId, publicJwk } = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const ed25519 = Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
      const did = didDocumentToNumAlgo2Did(
        new DidDocumentBuilder('')
          .addKeyAgreement(getEd25519VerificationKey2018({ id: '#key-1', publicJwk: ed25519, controller: '#id' }))
          .build()
      )
      const senderKey = toKeyAgreement(ed25519)
      senderKey.keyId = keyId
      const encrypted = await packAuthcrypt(
        { to: [recipient.did] },
        { did, didUrl: `${did}#key-1`, publicJwk: senderKey },
        recipient
      )

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        'Sender key must be X25519 when recipient is X25519'
      )
    })

    it('rejects a nested signature by someone other than the authcrypt sender', async () => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const signer = await createKeyAgreementDid()
      const { didDocument, keys } = await agent.dids.resolveCreatedDidDocumentWithKeys(signer.did)
      const [authentication] = didDocument.findVerificationMethodsByPurpose(['authentication'])
      const signingKeyId = keys?.find((key) => authentication.id.endsWith(key.didDocumentRelativeKeyId))?.kmsKeyId
      if (!signingKeyId) throw new Error(`No authentication key in ${signer.did}`)

      const encrypted = await agent.dependencyManager.resolve(DidCommV2EnvelopeService).packSignedAndEncrypted(
        agent.context,
        { id: utils.uuid(), type: DidCommTrustPingMessage.type.messageTypeUri, to: [recipient.did] },
        { keyId: signingKeyId, kid: toAbsoluteDidUrl(didDocument.id, authentication.id), alg: 'EdDSA' },
        {
          senderKey: sender.publicJwk,
          senderKeySkid: sender.didUrl,
          recipientKey: recipient.publicJwk,
          recipientKid: recipient.didUrl,
        }
      )

      await expect(agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)).rejects.toThrow(
        /nested signer .* does not match the authcrypt sender/
      )
    })

    it.each([
      { case: 'names the recipient DID', to: 'recipient', warns: false },
      { case: 'is absent', to: undefined, warns: false },
      { case: 'names only another DID', to: 'did:example:someone-else', warns: true },
    ])('only warns about to when it $case', async ({ to, warns }) => {
      const sender = await createKeyAgreementDid()
      const recipient = await createKeyAgreementDid()
      const encrypted = await packAuthcrypt(
        { to: to === undefined ? undefined : [to === 'recipient' ? recipient.did : to] },
        sender,
        recipient
      )
      const warn = vi.spyOn(agent.config.logger, 'warn')

      try {
        await agent.dependencyManager.resolve(DidCommV2Envelope).unpack(agent.context, encrypted)
        expect(warn).toHaveBeenCalledTimes(warns ? 1 : 0)
      } finally {
        warn.mockRestore()
      }
    })
  })
})
