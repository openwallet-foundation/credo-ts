import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { JwsService } from '../../../crypto'
import { JwtPayload } from '../../../crypto/jose/jwt'
import { KeyManagementModuleConfig, PublicJwk } from '../../kms'
import { DidKey, type KeyDidCreateOptions } from '../methods'

describe('kms backend of did keys', () => {
  const agent = new Agent(getAgentOptions('didKmsBackend'))
  const otherBackend = Object.assign(new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()), {
    backend: 'other',
  })
  const jwsService = agent.context.resolve(JwsService)
  const payload = new JwtPayload({ iss: 'issuer' })

  beforeAll(async () => {
    agent.context.resolve(KeyManagementModuleConfig).registerBackend(otherBackend)
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('stores the backend on the did record and signs without looking the key up', async () => {
    const { keyId } = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' }, backend: 'other' })
    const { didState } = await agent.dids.create<KeyDidCreateOptions>({ method: 'key', options: { keyId } })
    const [didRecord] = await agent.dids.getCreatedDids({ did: didState.did })
    expect(didRecord.keys?.[0].kmsBackend).toEqual('other')

    const kid = didState.didDocument?.verificationMethod?.[0].id as string
    const { publicJwk } = await agent.dids.resolveVerificationMethodFromCreatedDidRecord(kid)
    const getPublicKey = vi.spyOn(agent.context.resolve(KeyManagementModuleConfig).backends[0], 'getPublicKey')

    await jwsService.createJwsCompact(agent.context, {
      key: publicJwk,
      payload,
      protectedHeaderOptions: { alg: 'EdDSA', kid },
    })

    expect(getPublicKey).not.toHaveBeenCalled()
  })

  test('creates the key in the backend from createKey', async () => {
    const { didState } = await agent.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, backend: 'other' } },
    })
    const [didRecord] = await agent.dids.getCreatedDids({ did: didState.did })
    expect(didRecord.keys?.[0].kmsBackend).toEqual('other')
    await expect(
      otherBackend.getPublicKey(agent.context, didRecord.keys?.[0].kmsKeyId as string)
    ).resolves.toBeDefined()
  })

  test('throws when the did record key id points at a different key', async () => {
    const didKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const otherKey = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const did = new DidKey(PublicJwk.fromPublicJwk(didKey.publicJwk))
    await agent.dids.import({
      did: did.did,
      keys: [{ didDocumentRelativeKeyId: `#${did.publicJwk.fingerprint}`, kmsKeyId: otherKey.keyId }],
    })

    const kid = `${did.did}#${did.publicJwk.fingerprint}`
    const { publicJwk } = await agent.dids.resolveVerificationMethodFromCreatedDidRecord(kid)

    await expect(
      jwsService.createJwsCompact(agent.context, {
        key: publicJwk,
        payload,
        protectedHeaderOptions: { alg: 'EdDSA', kid },
      })
    ).rejects.toThrow(`Key with key id '${otherKey.keyId}' does not match the expected`)
  })
})
