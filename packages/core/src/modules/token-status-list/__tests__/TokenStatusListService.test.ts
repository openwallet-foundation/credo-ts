import { StatusList, StatusListCwt, StatusType } from '@owf/token-status-list'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { Jwt } from '../../../crypto'
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
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
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

    test('creates a CWT status list with a pre-built StatusList instance', async () => {
      const preBuilt = new StatusList(new Array(8).fill(0), 2)

      const result = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'cwt',
        statusList: preBuilt,
        statusListUri: 'https://example.com/status/2',
        keyId: key.keyId,
      })

      expect(result.format).toBe('cwt')
      const cwt = StatusListCwt.fromToken(result.statusList as Uint8Array)
      expect(cwt.payload.statusList.getBitsPerStatus()).toBe(2)
      expect(cwt.payload.statusList.statusList.length).toBe(8)
    })

    test('creates a CWT status list with issuedAt, expiresAt and timeToLive', async () => {
      const issuedAt = new Date('2025-01-01T00:00:00Z')
      const expiresAt = new Date('2026-01-01T00:00:00Z')

      const result = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'cwt',
        statusList: { statusListLength: 8, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/3',
        keyId: key.keyId,
        issuedAt,
        expiresAt,
        timeToLive: 3600,
      })

      expect(result.format).toBe('cwt')
      const cwt = StatusListCwt.fromToken(result.statusList as Uint8Array)
      expect(cwt.payload.issuedAt).toEqual(issuedAt)
      expect(cwt.payload.expirationTime).toEqual(expiresAt)
      expect(cwt.payload.timeToLive).toBe(3600)
    })

    test('creates a JWT status list', async () => {
      const result = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      })

      expect(result.format).toBe('jwt')
      expect(typeof result.statusList).toBe('string')

      const jwt = Jwt.fromSerializedJwt(result.statusList as string)
      expect(jwt.payload.additionalClaims.status_list).toBeDefined()
      expect(jwt.payload.additionalClaims.sub).toBe('https://example.com/status/1')
      expect(typeof jwt.payload.additionalClaims.iat).toBe('number')
    })

    test('creates a JWT status list with issuedAt, expiresAt, timeToLive, and additionalPayload', async () => {
      const issuedAt = new Date('2025-06-01T00:00:00Z')
      const expiresAt = new Date('2026-06-01T00:00:00Z')

      const result = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: { statusListLength: 8, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/4',
        keyId: key.keyId,
        issuedAt,
        expiresAt,
        timeToLive: 86400,
        additionalPayload: { iss: 'https://issuer.example.com' },
      })

      expect(result.format).toBe('jwt')
      const jwt = Jwt.fromSerializedJwt(result.statusList as string)
      const claims = jwt.payload.additionalClaims

      expect(claims.iat).toBe(Math.floor(issuedAt.getTime() / 1000))
      expect(claims.exp).toBe(Math.floor(expiresAt.getTime() / 1000))
      expect(claims.ttl).toBe(86400)
      expect(claims.iss).toBe('https://issuer.example.com')
      expect(claims.sub).toBe('https://example.com/status/4')
    })

    test('creates a JWT status list with a pre-built StatusList instance', async () => {
      const preBuilt = new StatusList(new Array(8).fill(0), 2)

      const result = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: preBuilt,
        statusListUri: 'https://example.com/status/5',
        keyId: key.keyId,
      })

      expect(result.format).toBe('jwt')
      const jwt = Jwt.fromSerializedJwt(result.statusList as string)
      const statusListClaim = jwt.payload.additionalClaims.status_list as { bits: number; lst: string }
      expect(statusListClaim.bits).toBe(2)
    })

    test('throws error for unsupported format', async () => {
      const options = {
        format: 'invalid' as const,
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
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
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })
  })

  describe('updateTokenStatusList', () => {
    test('updates a CWT status list', async () => {
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as Uint8Array,
        status: { index: 3, status: StatusType.Invalid },
        keyId: key.keyId,
      })

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)

      const cwt = StatusListCwt.fromToken(result.statusList)
      expect(cwt.payload.statusList.getStatus(3)).toBe(1)
    })

    test('updates a CWT status list with new issuedAt and expiresAt', async () => {
      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'cwt',
        statusList: { statusListLength: 8, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      })

      const newIssuedAt = new Date('2025-03-01T00:00:00Z')
      const newExpiresAt = new Date('2026-03-01T00:00:00Z')

      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as Uint8Array,
        status: { index: 0, status: StatusType.Invalid },
        keyId: key.keyId,
        issuedAt: newIssuedAt,
        expiresAt: newExpiresAt,
        timeToLive: 7200,
      })

      const cwt = StatusListCwt.fromToken(result.statusList)
      expect(cwt.payload.issuedAt).toEqual(newIssuedAt)
      expect(cwt.payload.expirationTime).toEqual(newExpiresAt)
      expect(cwt.payload.timeToLive).toBe(7200)
    })

    test('updates a JWT status list', async () => {
      const issuedAt = new Date('2025-01-01T00:00:00Z')

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: { statusListLength: 16, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
        issuedAt,
      })

      const newIssuedAt = new Date('2025-06-01T00:00:00Z')

      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as string,
        status: { index: 5, status: StatusType.Invalid },
        keyId: key.keyId,
        issuedAt: newIssuedAt,
      })

      expect(typeof result.statusList).toBe('string')
      const jwt = Jwt.fromSerializedJwt(result.statusList as string)
      const claims = jwt.payload.additionalClaims

      expect(claims.iat).toBe(Math.floor(newIssuedAt.getTime() / 1000))

      // Verify entry was updated
      const { getListFromStatusListJWT } = await import('@owf/token-status-list')
      const list = getListFromStatusListJWT(result.statusList as string)
      expect(list.getStatus(5)).toBe(StatusType.Invalid)
    })

    test('updates a JWT status list with new expiresAt, timeToLive, and additionalPayload', async () => {
      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: { statusListLength: 8, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/6',
        keyId: key.keyId,
      })

      const newExpiresAt = new Date('2027-01-01T00:00:00Z')

      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as string,
        status: { index: 2, status: StatusType.Suspended },
        keyId: key.keyId,
        expiresAt: newExpiresAt,
        timeToLive: 1800,
        additionalPayload: { custom_claim: 'value' },
      })

      const jwt = Jwt.fromSerializedJwt(result.statusList as string)
      const claims = jwt.payload.additionalClaims

      expect(claims.exp).toBe(Math.floor(newExpiresAt.getTime() / 1000))
      expect(claims.ttl).toBe(1800)
      expect(claims.custom_claim).toBe('value')
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
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        statusList: { statusListLength: 24, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/1',
        keyId: key.keyId,
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

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

      const cwt = StatusListCwt.fromToken(result.statusList)
      expect(cwt.payload.statusList.getStatus(1)).toBe(1)
      expect(cwt.payload.statusList.getStatus(7)).toBe(1)
      expect(cwt.payload.statusList.getStatus(12)).toBe(1)
    })

    test('batch updates a JWT status list', async () => {
      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, {
        format: 'jwt',
        statusList: { statusListLength: 24, bitsPerStatus: 1 },
        statusListUri: 'https://example.com/status/7',
        keyId: key.keyId,
      })

      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        token: statusList as string,
        status: [
          { index: 2, status: StatusType.Invalid },
          { index: 9, status: StatusType.Suspended },
          { index: 15, status: StatusType.Invalid },
        ],
        keyId: key.keyId,
      })

      expect(typeof result.statusList).toBe('string')

      const { getListFromStatusListJWT } = await import('@owf/token-status-list')
      const list = getListFromStatusListJWT(result.statusList as string)
      expect(list.getStatus(2)).toBe(StatusType.Invalid)
      expect(list.getStatus(9)).toBe(StatusType.Suspended)
      expect(list.getStatus(15)).toBe(StatusType.Invalid)
    })
  })

  describe('fetchTokenStatusList', () => {
    test('method exists and can be invoked', async () => {
      expect(tokenStatusListService.fetchTokenStatusList).toBeDefined()
      expect(typeof tokenStatusListService.fetchTokenStatusList).toBe('function')
    })

    test('type inference works', async () => {
      const _cwtResult: Promise<{ format: 'cwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['cwt'],
        uri: '',
      })
      await expect(_cwtResult).rejects.toThrow()

      const _jwtResult2: Promise<{ format: 'jwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['jwt'],
        uri: '',
      })
      await expect(_jwtResult2).rejects.toThrow()

      // @ts-expect-error invalid type match
      const _jwtInvalidResult: Promise<{ format: 'cwt' }> = tokenStatusListService.fetchTokenStatusList(agentContext, {
        acceptedFormats: ['jwt'],
        uri: '',
      })
      await expect(_jwtInvalidResult).rejects.toThrow()

      const _jwtCwtValidResult: Promise<{ format: 'cwt' | 'jwt' }> = tokenStatusListService.fetchTokenStatusList(
        agentContext,
        {
          uri: '',
        }
      )
      await expect(_jwtCwtValidResult).rejects.toThrow()
    })
  })
})
