import { CoseKey, SignatureAlgorithm } from '@owf/cose'
import { getAgentContext } from '../../../tests'
import { KeyManagementApi, PublicJwk } from '../../modules/kms'
import { getSign1Context } from '../contexts/sign1Context'

const agentContext = getAgentContext()
const kms = agentContext.resolve(KeyManagementApi)

describe('getSign1Context', () => {
  const toBeSigned = new Uint8Array([1, 2, 3])
  const algorithm = SignatureAlgorithm.ES256
  const createKey = async () => PublicJwk.fromKmsKey(await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))
  const coseKey = (key: PublicJwk, options: { includeKid: boolean }) => CoseKey.fromJwk(key.toJson(options))

  test('signs with the KMS key id and backend of the key with the same public key', async () => {
    const key = await createKey()
    const sign = vi.spyOn(kms, 'sign')

    await getSign1Context(agentContext, [await createKey(), key]).sign({
      key: coseKey(key, { includeKid: false }),
      toBeSigned,
      algorithm,
    })

    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ keyId: key.keyId, backend: key.kmsBackend }))
    sign.mockRestore()
  })

  test.each([true, false])('throws when no key has its public key (COSE key with keyId: %s)', async (includeKid) => {
    const key = await createKey()

    await expect(
      getSign1Context(agentContext, [await createKey()]).sign({
        key: coseKey(key, { includeKid }),
        toBeSigned,
        algorithm,
      })
    ).rejects.toThrow('No KMS key found for COSE key.')
  })
})
