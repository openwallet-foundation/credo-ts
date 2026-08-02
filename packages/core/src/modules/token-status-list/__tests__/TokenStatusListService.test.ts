import { StatusListCwt, StatusType } from '@owf/token-status-list'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JwsService, Jwt } from '../../../crypto'
import { CredoError } from '../../../error'
import { KeyManagementApi, KnownJwaSignatureAlgorithms, PublicJwk } from '../../../modules/kms'
import { DidKey, parseDid } from '../../dids'
import { X509Certificate, X509Service } from '../../x509'
import type { CreateTokenStatusListOptions, UpdateTokenStatusListOptions } from '../TokenStatusListOptions'
import { TokenStatusListService } from '../TokenStatusListService'

describe('TokenStatusListService', () => {
  const agent = new Agent(getAgentOptions('TokenStatusListService'))
  const agentContext = agent.context

  const tokenStatusListService = agent.context.dependencyManager.resolve(TokenStatusListService)
  const kms = agent.context.dependencyManager.resolve(KeyManagementApi)

  let didUrl: string
  let key: PublicJwk
  let certificate: X509Certificate

  beforeAll(async () => {
    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)
    const issuerKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const issuerDidKey = new DidKey(PublicJwk.fromPublicJwk(issuerKey.publicJwk))
    const issuerDidDocument = issuerDidKey.didDocument
    didUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      didDocument: issuerDidDocument,
      did: issuerDidDocument.id,
      keys: [
        {
          didDocumentRelativeKeyId: `#${didUrl.split('#')[1]}`,
          kmsKeyId: issuerKey.keyId,
        },
      ],
    })

    key = PublicJwk.fromPublicJwk(issuerKey.publicJwk)
    certificate = await X509Service.createCertificate(agent.context, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
      issuer: 'C=DE',
    })
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('createTokenStatusList', () => {
    test('creates a CWT status list with sign1', async () => {
      const options = {
        format: 'cwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        statusList: {
          statusListLength: 16,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
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
        alg: KnownJwaSignatureAlgorithms.ES256,
        statusList: {
          statusListLength: 16,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      }

      // @ts-expect-error: invalid format on purpose to test the code
      await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })

    test('throws error when key has no algorithm', async () => {
      // Create a mock key without alg
      const keyWithoutAlg = { ...key.toJson(), alg: undefined }
      vi.spyOn(kms, 'getPublicKey').mockResolvedValueOnce(keyWithoutAlg)

      const options = {
        format: 'cwt',
        statusList: {
          statusListLength: 16,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      } as unknown as CreateTokenStatusListOptions

      await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(CredoError)
    })

    test('create token status list with did', async () => {
      const options = {
        format: 'jwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        statusList: {
          statusListLength: 16,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'did',
          didUrl: didUrl,
        },
      } satisfies CreateTokenStatusListOptions

      const result = await tokenStatusListService.createTokenStatusList(agentContext, options)

      expect(result).toBeDefined()
      expect(result.statusList).toBeTypeOf('string')
      expect(result.format).toStrictEqual('jwt')

      const jwsService = agentContext.dependencyManager.resolve(JwsService)

      const { header, payload } = Jwt.fromSerializedJwt(result.statusList as string)
      expect(header.kid).toStrictEqual(`#${parseDid(didUrl).fragment}`)
      expect(payload.iss).toStrictEqual(parseDid(didUrl).did)
      expect(payload.additionalClaims.status_list).toBeDefined()

      await expect(
        jwsService.verifyJws(agentContext, {
          jws: result.statusList as string,
          resolveJwsSigner: () => ({ method: 'did', didUrl, jwk: key }),
        })
      ).resolves.toBeTruthy()
    })
  })

  test('create token status list with invalid did', async () => {
    const options = {
      format: 'jwt',
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: {
        statusListLength: 16,
        bitsPerStatus: 1,
      },
      statusListUri: 'https://example.com/status/1',
      signer: {
        method: 'did',
        didUrl: 'did:invalid',
      },
    } satisfies CreateTokenStatusListOptions

    await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow('invalid did')
  })

  test('create token status list with did in cwt format, not supported', async () => {
    const options = {
      format: 'cwt',
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: {
        statusListLength: 16,
        bitsPerStatus: 1,
      },
      statusListUri: 'https://example.com/status/1',
      signer: {
        method: 'did',
        didUrl: didUrl,
      },
    } satisfies CreateTokenStatusListOptions

    await expect(tokenStatusListService.createTokenStatusList(agentContext, options)).rejects.toThrow(
      'Unable to authenticate or sign the token status list'
    )
  })

  describe('updateTokenStatusList', () => {
    test('updates a CWT status list', async () => {
      // First create a CWT status list
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        statusList: {
          statusListLength: 16,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

      // Now update it
      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        format: 'cwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        token: statusList as Uint8Array,
        status: { index: 3, status: StatusType.Invalid },
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      })

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)

      // Verify the status was updated
      const cwt = StatusListCwt.fromToken(result.statusList as Uint8Array)
      expect(cwt.payload.statusList.getStatus(3)).toBe(1)
    })

    test('throws error when updating with invalid token type', async () => {
      const options = {
        token: 123 as unknown as Uint8Array,
        status: { index: 0, status: StatusType.Invalid },
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      }

      await expect(
        tokenStatusListService.updateTokenStatusList(agentContext, options as UpdateTokenStatusListOptions)
      ).rejects.toThrow(CredoError)
    })
  })

  describe('batchUpdateTokenStatusList', () => {
    test('batch updates a CWT status list', async () => {
      // First create a CWT status list
      const createOptions: CreateTokenStatusListOptions = {
        format: 'cwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        statusList: {
          statusListLength: 24,
          bitsPerStatus: 1,
        },
        statusListUri: 'https://example.com/status/1',
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      }

      const { statusList } = await tokenStatusListService.createTokenStatusList(agentContext, createOptions)

      // Now update multiple
      const result = await tokenStatusListService.updateTokenStatusList(agentContext, {
        format: 'cwt',
        alg: KnownJwaSignatureAlgorithms.ES256,
        token: statusList as Uint8Array,
        status: [
          { index: 1, status: StatusType.Invalid },
          { index: 7, status: StatusType.Invalid },
          { index: 12, status: StatusType.Invalid },
        ],
        signer: {
          method: 'x5c',
          x5c: [certificate],
        },
      })

      expect(result).toBeDefined()
      expect(result.statusList).toBeInstanceOf(Uint8Array)

      // Verify the statuses were updated
      const cwt = StatusListCwt.fromToken(result.statusList as Uint8Array)
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
