import { StatusListCwt, StatusType } from '@owf/token-status-list'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { CredoError } from '../../../error'
import { KeyManagementApi, type KmsJwkPublicEc, PublicJwk } from '../../../modules/kms'
import type { CreateTokenStatusListOptions } from '../TokenStatusListOptions'
import { TokenStatusListService } from '../TokenStatusListService'

describe('TokenStatusListService', () => {
  const agentConfig = getAgentConfig('TokenStatusListService')
  const agentContext = getAgentContext({ agentConfig })
  const tokenStatusListService = agentContext.dependencyManager.resolve(TokenStatusListService)
  const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

  let key: PublicJwk
  let jwkWithAlg: KmsJwkPublicEc & { alg: string; kid: string }

  beforeAll(async () => {
    // node kms does not seem to add the alg to the JWK, which is defined on the `key`
    const createdKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    key = PublicJwk.fromPublicJwk(createdKey.publicJwk)

    jwkWithAlg = {
      ...createdKey.publicJwk,
      alg: 'ES256',
    }

    vi.spyOn(kms, 'getPublicKey').mockImplementation(async () => jwkWithAlg)
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('createTokenStatusList', () => {
    test('creates a CWT status list with sign1', async () => {
      const options = {
        format: 'cwt',
        statusListLength: 16,
        bitsPerStatus: 1,
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      } satisfies CreateTokenStatusListOptions

      const result = await tokenStatusListService.createTokenStatusList(agentContext, options)

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)
      expect(result.format).toStrictEqual('cwt')

      // Verify it's a valid CWT
      const cwt = StatusListCwt.fromToken(result.statusList as Uint8Array)
      expect(cwt.payload).toBeDefined()
      expect(cwt.payload.statusList).toBeDefined()
      expect(cwt.payload.statusList.statusList.length).toBe(16)
    })

    test('throws error for unsupported format', async () => {
      const options = {
        format: 'invalid' as const,
        statusListLength: 16,
        bitsPerStatus: 1,
        hostingUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      // @ts-expect-error: invalid format on purpose to test the code
      await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })

    test('throws error when key has no algorithm', async () => {
      // Create a mock key without alg
      const keyWithoutAlg = { ...key.toJson(), alg: undefined }
      vi.spyOn(kms, 'getPublicKey').mockResolvedValueOnce(keyWithoutAlg)

      const options: CreateTokenStatusListOptions = {
        format: 'cwt',
        statusListLength: 16,
        bitsPerStatus: 1,
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })
  })

  describe('updateTokenStatusList', () => {
    test('updates a CWT status list', async () => {
      // First create a CWT status list
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        statusListLength: 16,
        bitsPerStatus: 1,
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

      // Now update it
      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as Uint8Array,
        status: { index: 3, status: StatusType.Invalid },
        keyId: key.keyId,
      })

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)

      // Verify the status was updated
      const cwt = StatusListCwt.fromToken(result.statusList)
      expect(cwt.payload.statusList.getStatus(3)).toBe(1)
    })

    test('throws error when updating with invalid token type', async () => {
      const options = {
        token: 123 as unknown as Uint8Array,
        status: { index: 0, status: StatusType.Invalid },
        keyId: key.keyId,
      }

      await expect(tokenStatusListService.updateTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })
  })

  describe('batchUpdateTokenStatusList', () => {
    test('batch updates a CWT status list', async () => {
      // First create a CWT status list
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        statusListLength: 24,
        bitsPerStatus: 1,
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

      // Now update multiple
      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as Uint8Array,
        status: [
          { index: 1, status: StatusType.Invalid },
          { index: 7, status: StatusType.Invalid },
          { index: 12, status: StatusType.Invalid },
        ],
        keyId: key.keyId,
      })

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)

      // Verify the statuses were updated
      const cwt = StatusListCwt.fromToken(result.statusList)
      expect(cwt.payload.statusList.getStatus(1)).toBe(1)
      expect(cwt.payload.statusList.getStatus(7)).toBe(1)
      expect(cwt.payload.statusList.getStatus(12)).toBe(1)
    })
  })

  describe('fetchTokenStatusList', () => {
    test('method exists and can be invoked', async () => {
      // Test that the method exists and has the correct signature
      expect(tokenStatusListService.fetchTokenStatusList).toBeDefined()
      expect(typeof tokenStatusListService.fetchTokenStatusList).toBe('function')
    })

    test('type inference works', async () => {
      const _cwtResult: Promise<{ format: 'cwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['cwt'],
        uri: '',
      })

      const _jwtResult2: Promise<{ format: 'jwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['jwt'],
        uri: '',
      })

      // @ts-expect-error invalid type match
      const _jwtInvalidResult: Promise<{ format: 'cwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['jwt'],
        uri: '',
      })

      const _jwtCwtValidResult: Promise<{ format: 'cwt' | 'jwt' }> = tokenStatusListService.fetchTokenStatusList(
        agentContext,
        {
          uri: '',
        }
      )
    })
  })
})
