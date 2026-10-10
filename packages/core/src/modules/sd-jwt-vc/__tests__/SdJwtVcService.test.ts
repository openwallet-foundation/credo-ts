import type { Constructable, SdJwtVc } from '@credo-ts/core'
import {
  Agent,
  CredoError,
  DidKey,
  DidsModule,
  Hasher,
  JsonEncoder,
  KeyDidRegistrar,
  KeyDidResolver,
  parseDid,
  TypedArrayEncoder,
  X509Certificate,
} from '@credo-ts/core'
import { SLException } from '@owf/token-status-list'
import { decodeSdJwtSync, getClaimsSync, Jwt, SDJwt } from '@sd-jwt/core'
import { randomUUID } from 'crypto'
import nock from 'nock'
import { type Mock, vi } from 'vitest'
import { transformSeedToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions, mockProperty } from '../../../../tests'
import { PublicJwk } from '../../kms'
import { applyDisclosuresForPaths, buildPresentationFrameForPaths } from '../disclosureFrame'
import { SdJwtVcRecord, SdJwtVcRepository } from '../repository'
import {
  type CustomStatusListFetcher,
  type CustomTypeMetadataResolver,
  SdJwtVcModuleConfig,
} from '../SdJwtVcModuleConfig'
import type { IDisclosureFrame } from '../SdJwtVcOptions'
import { SdJwtVcService } from '../SdJwtVcService'
import {
  contentChangedSdJwtVc,
  expiredSdJwtVc,
  notBeforeInFutureSdJwtVc,
  sdJwtVcPid,
  signatureInvalidSdJwtVc,
  simpleJwtVc,
  simpleJwtVcWithoutHolderBinding,
  simpleSdJwtVcWithStatus,
  simpleX509,
} from './sdjwtvc.fixtures'
import { generateStatusList } from './statusListTestUtils'

const mockJwtDecode = (mockedPayload: Partial<Jwt>) =>
  mockProperty(
    SDJwt,
    'extractJwt',
    async <Header extends Record<string, unknown>, Payload extends Record<string, unknown>>() =>
      mockedPayload as Jwt<Header, Payload>
  )

vi.mock('../repository/SdJwtVcRepository', () => ({
  SdJwtVcRepository: vi.fn(
    class SdJwtVcRepository {
      save = vi.fn()
    }
  ),
}))
const SdJwtVcRepositoryMock = SdJwtVcRepository as unknown as Constructable<SdJwtVcRepository>

const agent = new Agent(
  getAgentOptions(
    'sdjwtvcserviceagent',
    {},
    {},
    {
      dids: new DidsModule({
        resolvers: [new KeyDidResolver()],
        registrars: [new KeyDidRegistrar()],
      }),
    }
  )
)

const staticSalt = () => TypedArrayEncoder.fromUtf8String('salt')
agent.kms.randomBytes = vi.fn(staticSalt)

// Disclosure salts must be unique within a single sd-jwt, so tests issuing multiple disclosures need unique salts
const mockUniqueSalts = () => {
  let counter = 0
  vi.mocked(agent.kms.randomBytes).mockImplementation(() => TypedArrayEncoder.fromUtf8String(`salt${counter++}`))
}
const mockedNowSeconds = 1698151532
Date.prototype.getTime = vi.fn(function () {
  return mockedNowSeconds * 1000
})
Date.now = vi.fn(function () {
  return mockedNowSeconds * 1000
})

const simpleX509Certificate = X509Certificate.fromEncodedCertificate(simpleX509.trustedCertificate)

// Generates a status list JWT signed with an `x5c` header (x509), instead of a `kid` (did).

describe('SdJwtVcService', () => {
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  let issuerDidUrl: string
  let issuerKey: PublicJwk
  let holderKey: PublicJwk
  let sdJwtVcService: SdJwtVcService

  const mockStatusList = (statusList: string) =>
    nock('https://example.com')
      .get('/status-list')
      .matchHeader('accept', 'application/statuslist+jwt')
      .reply(200, statusList, { 'Content-Type': 'application/statuslist+jwt' })

  afterEach(() => {
    nock.cleanAll()
  })

  beforeAll(async () => {
    await agent.initialize()

    const issuerPrivateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000000'),
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    }).privateJwk
    issuerKey = PublicJwk.fromPublicJwk(
      (
        await agent.kms.importKey({
          privateJwk: issuerPrivateJwk,
        })
      ).publicJwk
    )

    const issuerDidKey = new DidKey(issuerKey)
    const issuerDidDocument = issuerDidKey.didDocument
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      didDocument: issuerDidDocument,
      did: issuerDidDocument.id,
      keys: [
        {
          didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`,
          kmsKeyId: issuerKey.keyId,
        },
      ],
    })

    simpleX509Certificate.keyId = issuerKey.keyId

    const holderPrivateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000001'),
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    }).privateJwk

    // We use hardcoded SD-JWT VCs which don't have a `kid` in the credential JWK
    // So we set the kid to the legacy key id
    holderPrivateJwk.kid = TypedArrayEncoder.toBase58(PublicJwk.fromPublicJwk(holderPrivateJwk).publicKey.publicKey)

    holderKey = PublicJwk.fromPublicJwk(
      (
        await agent.kms.importKey({
          privateJwk: holderPrivateJwk,
        })
      ).publicJwk
    )
    const holderDidKey = new DidKey(holderKey)
    const holderDidDocument = holderDidKey.didDocument
    const holderDidUrl = (holderDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({
      didDocument: holderDidDocument,
      did: holderDidDocument.id,
      keys: [
        {
          kmsKeyId: holderKey.keyId,
          didDocumentRelativeKeyId: `#${holderDidUrl.split('#')[1]}`,
        },
      ],
    })

    const sdJwtVcRepositoryMock = new SdJwtVcRepositoryMock()
    sdJwtVcService = new SdJwtVcService(sdJwtVcRepositoryMock)
  })

  describe('SdJwtVcService.sign', () => {
    afterEach(() => {
      vi.mocked(agent.kms.randomBytes).mockImplementation(staticSalt)
    })

    test('does not sign a presentation for an unregistered holder DID even if its key exists in KMS', async () => {
      const key = await agent.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const didUrl = new DidKey(PublicJwk.fromUnknown(key.publicJwk)).didDocument.verificationMethod?.[0]?.id
      if (!didUrl) throw new Error('Expected a DID verification method')

      // Deliberately do not call agent.dids.import: the key exists in KMS, but no created-DID record maps it to this DID.
      const credential = await sdJwtVcService.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential' },
        issuer: { method: 'did', didUrl: issuerDidUrl },
        holder: { method: 'did', didUrl },
      })
      await expect(
        sdJwtVcService.present(agent.context, {
          sdJwtVc: credential.compact,
          verifierMetadata: { issuedAt: mockedNowSeconds, audience: verifierDid, nonce: 'unregistered-holder' },
        })
      ).rejects.toThrow('not found')
    })

    test('Sign sd-jwt-vc from a basic payload without holder binding', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          iat: Math.floor(Date.now() / 1000),
        },
        headerType: 'vc+sd-jwt',
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(compact).toStrictEqual(simpleJwtVcWithoutHolderBinding)

      const sdJwtVc = sdJwtVcService.fromCompact(compact)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: parseDid(issuerDidUrl).did,
      })
    })

    test('Create sd-jwt-vc with sha-1 as hashing algorithm and fails', async () => {
      await expect(
        sdJwtVcService.sign(agent.context, {
          payload: { claim: 'some-claim', vct: 'IdentityCredential' },
          disclosureFrame: { _sd: ['claim'] },
          issuer: {
            method: 'did',
            didUrl: issuerDidUrl,
          },
          // `sha-1` is excluded on a type level, but JavaScript callers can still provide it
          hashingAlgorithm: 'sha-1' as never,
        })
      ).rejects.toThrow(
        "Unsupported hashing algorithm 'sha-1' for the disclosure digests of an SD-JWT. Supported hashing algorithms are sha-256, sha-384, sha-512"
      )
    })
  })

  describe('SdJwtVcService.receive', () => {
    test('Receive sd-jwt-vc without holder binding', async () => {
      const sdJwtVc = sdJwtVcService.fromCompact(simpleJwtVcWithoutHolderBinding)
      const sdJwtVcRecord = await sdJwtVcService.store(agent.context, {
        record: new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: simpleJwtVcWithoutHolderBinding,
            },
          ],
        }),
      })
      expect(sdJwtVcRecord.encoded).toEqual(simpleJwtVcWithoutHolderBinding)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: issuerDidUrl.split('#')[0],
      })
    })
  })

  describe('SdJwtVcService.applyDisclosuresForPayload', () => {
    test('Applies disclosures for given payload', async () => {
      const presentation = sdJwtVcService.applyDisclosuresForPayload(sdJwtVcPid, {
        given_name: 'ERIKA',
        birthdate: '1964-08-12',
        family_name: 'MUSTERMANN',
      })

      expect(presentation.prettyClaims).toStrictEqual({
        place_of_birth: {},
        address: {},
        issuing_country: 'DE',
        vct: 'https://example.bmi.bund.de/credential/pid/1.0',
        issuing_authority: 'DE',
        iss: 'https://demo.pid-issuer.bundesdruckerei.de/c1',
        cnf: {
          jwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'NeX_ZniwxDOJD_Kyqf678V-Yx3f3-DZ0yD9XerpFmcc',
            y: 'gpo5H0zWaPM9yc7M2rex4IZ6Geb9J2842T3t6X8frAM',
          },
        },
        exp: 1733709514,
        iat: 1732499914,
        age_equal_or_over: {},
        given_name: 'ERIKA',
        birthdate: '1964-08-12',
        family_name: 'MUSTERMANN',
      })
    })
  })

  describe('applyDisclosuresForPaths', () => {
    beforeEach(() => {
      mockUniqueSalts()
    })

    afterEach(() => {
      vi.mocked(agent.kms.randomBytes).mockImplementation(staticSalt)
    })

    const sign = (payload: Record<string, unknown>, disclosureFrame: IDisclosureFrame) =>
      sdJwtVcService.sign(agent.context, {
        payload: { vct: 'IdentityCredential', ...payload },
        disclosureFrame,
        holder: { method: 'jwk', jwk: holderKey },
        issuer: { method: 'did', didUrl: issuerDidUrl },
      })

    test('Returns the SD-JWT VC with only the disclosures for the paths', async () => {
      const { compact } = await sign(
        { given_name: 'Erika', family_name: 'Mustermann' },
        { _sd: ['given_name', 'family_name'] }
      )

      const sdJwtVc = sdJwtVcService.applyDisclosuresForPaths(compact, [['given_name']])

      expect(sdJwtVc.prettyClaims.given_name).toBe('Erika')
      expect(sdJwtVc.prettyClaims).not.toHaveProperty('family_name')
    })

    test('Discloses only the array elements at the given positions', async () => {
      const { compact } = await sign({ nationalities: ['DE', 'NL', 'FR'] }, { nationalities: { _sd: [0, 1, 2] } })

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['nationalities', 1]])

      expect(prettyClaims.nationalities).toStrictEqual(['NL'])
      expect(disclosedPaths.filter((path) => path[0] === 'nationalities')).toStrictEqual([['nationalities', 1]])
    })

    test('Discloses all elements of an array whose elements are not selectively disclosable', async () => {
      const { compact } = await sign({ nationalities: ['DE', 'NL', 'FR'] }, { _sd: ['nationalities'] })

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['nationalities', 1]])

      expect(prettyClaims.nationalities).toStrictEqual(['DE', 'NL', 'FR'])
      expect(disclosedPaths.filter((path) => path[0] === 'nationalities')).toStrictEqual([['nationalities']])
    })

    test('Discloses claims in selectively disclosable array elements', async () => {
      const { compact } = await sign(
        {
          addresses: [
            { street: 'Main St', city: 'Anytown' },
            { street: 'Second St', city: 'Othertown' },
          ],
        },
        { addresses: { _sd: [0, 1], 0: { _sd: ['street', 'city'] }, 1: { _sd: ['street', 'city'] } } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['addresses', 1, 'city']])

      expect(prettyClaims.addresses).toStrictEqual([{ city: 'Othertown' }])
      expect(disclosedPaths.filter((path) => path[0] === 'addresses')).toStrictEqual([['addresses', 1, 'city']])
    })

    test('Discloses the selectively disclosable claims nested in a requested object', async () => {
      const { compact } = await sign(
        {
          address: {
            street: 'Main St',
            city: 'Anytown',
            country: { code: 'DE', name: 'Germany' },
          },
        },
        { _sd: ['address'], address: { _sd: ['street', 'city', 'country'], country: { _sd: ['code', 'name'] } } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['address']])

      expect(prettyClaims.address).toStrictEqual({
        street: 'Main St',
        city: 'Anytown',
        country: { code: 'DE', name: 'Germany' },
      })
      expect(disclosedPaths.filter((path) => path[0] === 'address')).toStrictEqual([['address']])
    })

    test('Discloses the selectively disclosable claims on the way to a requested claim', async () => {
      const { compact } = await sign(
        { address: { street: 'Main St', country: { code: 'DE', name: 'Germany' } } },
        { _sd: ['address'], address: { _sd: ['street', 'country'], country: { _sd: ['code', 'name'] } } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['address', 'country', 'code']])

      expect(prettyClaims.address).toStrictEqual({ country: { code: 'DE' } })
      expect(disclosedPaths.filter((path) => path[0] === 'address')).toStrictEqual([['address', 'country', 'code']])
    })

    test('Has a single path for a requested array with many nested selectively disclosable claims', async () => {
      const drivingPrivileges = Array.from({ length: 1000 }, (_, index) => ({
        vehicle_category_code: `C${index}`,
        codes: [{ code: 'D', sign: '=', value: String(index) }],
      }))

      const { compact } = await sign(
        { driving_privileges: drivingPrivileges },
        {
          _sd: ['driving_privileges'],
          driving_privileges: {
            _sd: drivingPrivileges.map((_, index) => index),
            ...Object.fromEntries(
              drivingPrivileges.map((_, index) => [index, { _sd: ['vehicle_category_code', 'codes'] }])
            ),
          },
        }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['driving_privileges']])

      expect(prettyClaims.driving_privileges).toStrictEqual(drivingPrivileges)
      expect(disclosedPaths.filter((path) => path[0] === 'driving_privileges')).toStrictEqual([['driving_privileges']])
    })

    test('Builds a presentation frame that discloses everything below a path', async () => {
      const { compact } = await sign(
        { address: { street: 'Main St', country: { code: 'DE', name: 'Germany' } } },
        { _sd: ['address'], address: { _sd: ['street', 'country'], country: { _sd: ['code', 'name'] } } }
      )

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: compact,
        presentationFrame: buildPresentationFrameForPaths(compact, [['address']]),
      })

      expect(sdJwtVcService.fromCompact(presentation).prettyClaims.address).toStrictEqual({
        street: 'Main St',
        country: { code: 'DE', name: 'Germany' },
      })
    })

    test('Only discloses the requested claims nested in an object', async () => {
      const { compact } = await sign(
        { address: { street: 'Main St', city: 'Anytown' } },
        { _sd: ['address'], address: { _sd: ['street', 'city'] } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['address', 'city']])

      expect(prettyClaims.address).toStrictEqual({ city: 'Anytown' })
      expect(disclosedPaths.filter((path) => path[0] === 'address')).toStrictEqual([['address', 'city']])
    })

    test('Includes the path to a disclosed claim with a null value', async () => {
      const { compact } = await sign({ middle_name: null, given_name: 'Erika' }, { _sd: ['given_name'] })

      const { disclosedPaths } = applyDisclosuresForPaths(compact, [])

      expect(disclosedPaths).toContainEqual(['middle_name'])
      expect(disclosedPaths).not.toContainEqual(['given_name'])
    })

    // Builds an SD-JWT that is not signed, for payloads that sign() does not create
    const buildUnsignedSdJwt = (
      buildPayload: (digest: (disclosure: unknown[]) => string) => object,
      alg = 'sha-256'
    ) => {
      const toBase64Url = (value: unknown) =>
        TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JSON.stringify(value)))

      const disclosures: string[] = []
      const payload = buildPayload((disclosure) => {
        const encoded = toBase64Url(disclosure)
        disclosures.push(encoded)
        return TypedArrayEncoder.toBase64Url(Hasher.hash(encoded, alg))
      })

      return `${toBase64Url({ alg: 'ES256' })}.${toBase64Url(payload)}.signature~${disclosures.map((disclosure) => `${disclosure}~`).join('')}`
    }

    // The claims of an SD-JWT, which unlike fromCompact() does not need an issuer
    const getClaims = (compact: string) => {
      const { jwt, disclosures } = decodeSdJwtSync(compact, Hasher.hash)
      return getClaimsSync(jwt.payload, disclosures, Hasher.hash) as Record<string, unknown>
    }

    test('Gives array elements after a decoy digest the position they have in the claims', async () => {
      const compact = buildUnsignedSdJwt((digest) => ({
        vct: 'IdentityCredential',
        nationalities: [
          { '...': digest(['salt1', 'DE']) },
          { '...': TypedArrayEncoder.toBase64Url(Hasher.hash('decoy', 'sha-256')) },
          { '...': digest(['salt2', 'FR']) },
        ],
      }))
      expect(getClaims(compact).nationalities).toStrictEqual(['DE', 'FR'])

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['nationalities', 1]])
      expect(prettyClaims.nationalities).toStrictEqual(['FR'])
      expect(disclosedPaths.filter((path) => path[0] === 'nationalities')).toStrictEqual([['nationalities', 1]])

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: compact,
        presentationFrame: buildPresentationFrameForPaths(compact, disclosedPaths),
      })
      expect(getClaims(presentation).nationalities).toStrictEqual(['FR'])
    })

    test('Does not disclose the claims on the way to a path without a claim', async () => {
      const { compact } = await sign(
        { address: { street: 'Main St', city: 'Anytown' } },
        { _sd: ['address'], address: { _sd: ['street', 'city'] } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['address', 'country']])

      expect(prettyClaims.address).toBeUndefined()
      expect(disclosedPaths.filter((path) => path[0] === 'address')).toStrictEqual([])
      expect(buildPresentationFrameForPaths(compact, [['address', 'country']])).not.toHaveProperty('address')
    })

    test('Only has a single path for a nested claim when everything below it is disclosed', async () => {
      const { compact } = await sign(
        { address: { street: 'Main St', country: { code: 'DE', name: 'Germany' } } },
        { _sd: ['address'], address: { _sd: ['street'], country: { _sd: ['name'] } } }
      )

      const { prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['address', 'street']])

      expect(prettyClaims.address).toStrictEqual({ street: 'Main St', country: { code: 'DE' } })
      expect(disclosedPaths.filter((path) => path[0] === 'address')).toStrictEqual([
        ['address', 'country', 'code'],
        ['address', 'street'],
      ])
    })

    test('Selects an array element only by a number, and a property only by a string', async () => {
      const { compact } = await sign(
        { list: ['a', 'b'], object: { '0': 'zero', '1': 'one' } },
        { list: { _sd: [0, 1] }, object: { _sd: ['0', '1'] } }
      )

      const claimsFor = (paths: Array<Array<string | number>>) => applyDisclosuresForPaths(compact, paths).prettyClaims

      expect(claimsFor([['list', 0]]).list).toStrictEqual(['a'])
      expect(claimsFor([['list', '0']]).list).toStrictEqual([])
      expect(claimsFor([['object', '0']]).object).toStrictEqual({ '0': 'zero' })
      expect(claimsFor([['object', 0]]).object).toStrictEqual({})
    })

    test('Uses the hash algorithm of the SD-JWT', () => {
      const compact = buildUnsignedSdJwt(
        (digest) => ({
          vct: 'IdentityCredential',
          _sd_alg: 'sha-384',
          _sd: [digest(['salt1', 'given_name', 'Erika']), digest(['salt2', 'family_name', 'Mustermann'])],
        }),
        'sha-384'
      )

      const { compact: disclosed, prettyClaims, disclosedPaths } = applyDisclosuresForPaths(compact, [['given_name']])

      expect(prettyClaims).toStrictEqual({ vct: 'IdentityCredential', given_name: 'Erika' })
      expect(disclosedPaths).toStrictEqual([['vct'], ['given_name']])
      expect(getClaims(disclosed)).toStrictEqual({
        vct: 'IdentityCredential',
        given_name: 'Erika',
      })
    })
  })

  describe('SdJwtVcService.present', () => {
    test('Present sd-jwt-vc without holder binding', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleJwtVcWithoutHolderBinding,
        presentationFrame: {},
      })

      // Input should be the same as output
      expect(presentation).toStrictEqual(simpleJwtVcWithoutHolderBinding)
    })

    test('Errors when providing verifier metadata but SD-JWT VC has no cnf claim', async () => {
      await expect(
        sdJwtVcService.present(agent.context, {
          sdJwtVc: simpleJwtVcWithoutHolderBinding,
          presentationFrame: {},
          verifierMetadata: {
            audience: 'verifier',
            issuedAt: Date.now() / 1000,
            nonce: randomUUID(),
          },
        })
      ).rejects.toThrow("Verifier metadata provided, but credential has no 'cnf' claim to create a KB-JWT from")
    })
  })

  describe('SdJwtVcService.verify', () => {
    test('Verify sd-jwt-vc without holder binding', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleJwtVcWithoutHolderBinding,
        // no disclosures
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify sd-jwt-vc with status where credential is not revoked', async () => {
      const sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)

      const statusList = await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [])

      // Mock call to status list
      nock('https://example.com')
        .get('/status-list')
        .matchHeader('accept', 'application/statuslist+jwt')
        .reply(200, statusList, { 'Content-Type': 'application/statuslist+jwt' })

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify sd-jwt-vc with status where credential is revoked and fails', async () => {
      const sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)

      const statusList = await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [12])

      // Mock call to status list
      nock('https://example.com')
        .get('/status-list')
        .matchHeader('accept', 'application/statuslist+jwt')
        .reply(200, statusList, { 'Content-Type': 'application/statuslist+jwt' })

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        sdJwtVc: expect.any(Object),
        error: expect.objectContaining({
          name: 'SDJWTException',
          message: 'Status is not valid',
          code: 'STATUS_INVALID',
        }),
      })
    })

    test('Verify sd-jwt-vc with status where status list is not valid and fails', async () => {
      const sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)

      const statusList = await generateStatusList(agent.context, issuerKey, issuerDidUrl, 8, [])

      // Mock call to status list
      nock('https://example.com')
        .get('/status-list')
        .matchHeader('accept', 'application/statuslist+jwt')
        .reply(200, statusList, { 'Content-Type': 'application/statuslist+jwt' })

      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleSdJwtVcWithStatus,
        presentationFrame: {},
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        sdJwtVc: expect.any(Object),
        error: new Error('Index out of bounds'),
      })
    })

    test('verify expired sd-jwt-vc and fails', async () => {
      // 31 seconds due to the skew of 30 seconds
      Date.prototype.getTime = vi.fn(function () {
        return 1716111919 * 1000 + 31000
      })
      Date.now = vi.fn(function () {
        return 1716111919 * 1000 + 31000
      })
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: expiredSdJwtVc,
      })

      Date.prototype.getTime = vi.fn(function () {
        return 1698151532000
      })
      Date.now = vi.fn(function () {
        return 1698151532000
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: expect.objectContaining({
          name: 'JwtTimeClaimException',
          message: 'Verify Error: JWT is expired',
          code: 'JWT_EXPIRED',
        }),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with nbf in future and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: notBeforeInFutureSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: expect.objectContaining({
          name: 'JwtTimeClaimException',
          message: 'Verify Error: JWT is not yet valid',
          code: 'JWT_NOT_YET_VALID',
        }),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with content changed and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: contentChangedSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: expect.objectContaining({
          name: 'SDJWTException',
          message: 'Verify Error: Invalid JWT Signature',
          code: 'INVALID_JWT_SIGNATURE',
        }),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with invalid signature and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: signatureInvalidSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: expect.objectContaining({
          name: 'SDJWTException',
          message: 'Verify Error: Invalid JWT Signature',
          code: 'INVALID_JWT_SIGNATURE',
        }),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc signed with a sha-1 based signature algorithm and fails', async () => {
      // SHA-1 based signature algorithms (such as RS1) are not registered JWA signature algorithms,
      // and thus can never be used to sign or verify an sd-jwt-vc
      const [jwt, ...disclosures] = simpleJwtVc.split('~')
      const [encodedHeader, encodedPayload, signature] = jwt.split('.')
      const header = JsonEncoder.fromBase64Url(encodedHeader)

      const sha1SignedSdJwtVc = [
        [JsonEncoder.toBase64Url({ ...header, alg: 'RS1' }), encodedPayload, signature].join('.'),
        ...disclosures,
      ].join('~')

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: sha1SignedSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: new CredoError("Expected JWT header 'alg' to be a known JWA signature algorithm, found 'RS1'"),
        sdJwtVc: expect.any(Object),
      })
    })
  })

  describe('SdJwtVcService.verify fetches the status list', () => {
    const statusListUri = 'https://example.com/status-list'

    const presentWithStatus = async () => {
      const sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)
      return sdJwtVcService.present(agent.context, { sdJwtVc: simpleSdJwtVcWithStatus, presentationFrame: {} })
    }

    const verify = async (compactSdJwtVc: string) => {
      const sdJwtVcService = agent.dependencyManager.resolve(SdJwtVcService)
      return sdJwtVcService.verify(agent.context, { compactSdJwtVc })
    }

    afterEach(() => {
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, new SdJwtVcModuleConfig())
    })

    test('uses the custom status list fetcher instead of an HTTP GET', async () => {
      const statusList = await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [])
      const customStatusListFetcher = vi.fn(async () => statusList)
      agent.context.dependencyManager.registerInstance(
        SdJwtVcModuleConfig,
        new SdJwtVcModuleConfig({ customStatusListFetcher })
      )

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult.isValid).toBe(true)
      expect(customStatusListFetcher).toHaveBeenCalledWith(statusListUri, {
        defaultFetcher: expect.any(Function),
      })
    })

    test('the custom status list fetcher can delegate to the default fetcher', async () => {
      const scope = mockStatusList(await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, []))
      let defaultFetcher: Mock<() => Promise<string>> | undefined
      const customStatusListFetcher: CustomStatusListFetcher = async (_uri, options) => {
        defaultFetcher = vi.fn(options.defaultFetcher)
        return defaultFetcher()
      }
      agent.context.dependencyManager.registerInstance(
        SdJwtVcModuleConfig,
        new SdJwtVcModuleConfig({ customStatusListFetcher })
      )

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult.isValid).toBe(true)
      expect(defaultFetcher).toHaveBeenCalledTimes(1)
      expect(scope.isDone()).toBe(true)
    })

    test('verifies the status against the status list JWT the custom status list fetcher returns', async () => {
      const statusList = await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [12])
      agent.context.dependencyManager.registerInstance(
        SdJwtVcModuleConfig,
        new SdJwtVcModuleConfig({ customStatusListFetcher: async () => statusList })
      )

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult).toEqual({
        isValid: false,
        sdJwtVc: expect.any(Object),
        error: expect.objectContaining({
          name: 'SDJWTException',
          message: 'Status is not valid',
          code: 'STATUS_INVALID',
        }),
      })
    })

    test("rejects a status list JWT whose 'typ' is not 'statuslist+jwt'", async () => {
      mockStatusList(await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [], { typ: 'JWT' }))

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult).toEqual({
        isValid: false,
        sdJwtVc: expect.any(Object),
        error: expect.objectContaining({
          name: 'SLException',
          message: "The typ header 'JWT' must be equal to 'statuslist+jwt'",
        }),
      })
    })

    test("accepts a status list JWT whose 'typ' is 'application/statuslist+jwt'", async () => {
      mockStatusList(
        await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [], { typ: 'application/statuslist+jwt' })
      )

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult.isValid).toBe(true)
    })

    test("rejects a status list JWT whose 'sub' is not the uri of the status claim", async () => {
      const otherUri = 'https://example.com/other-status-list'
      mockStatusList(await generateStatusList(agent.context, issuerKey, issuerDidUrl, 24, [], { sub: otherUri }))

      const verificationResult = await verify(await presentWithStatus())

      expect(verificationResult).toEqual({
        isValid: false,
        sdJwtVc: expect.any(Object),
        // `@sd-jwt/sd-jwt-vc` does this check
        error: new SLException(`The subject claim '${otherUri}' must be equal to the uri '${statusListUri}'`),
      })
    })
  })

  describe('SdJwtVcService.fetchTypeMetadata', () => {
    test('Fetch type metadata from new vct URL path', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata from legacy vct URL path when new path fails', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(404)

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata from legacy vct URL path when new path throws error', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').replyWithError('CORS error')

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with nested path', async () => {
      const mockMetadata = {
        vct: 'https://example.com/v1/credentials/identity/verified',
        name: 'Verified Identity Credential',
      }

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/v1/credentials/identity/verified',
        },
      })

      nock('https://example.com').get('/v1/credentials/identity/verified').reply(404)

      nock('https://example.com').get('/.well-known/vct/v1/credentials/identity/verified').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/v1/credentials/identity/verified',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/v1/credentials/identity/verified'],
      })
    })

    test('Fetch type metadata throws error for non-https vct', async () => {
      mockJwtDecode({
        payload: {
          vct: 'http://example.com/credentials/identity',
        },
      })

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'http://example.com/credentials/identity',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow(
        "Unable to resolve type metadata for vct 'http://example.com/credentials/identity'. Only https supported"
      )
    })

    test('Fetch type metadata returns undefined for non-url vct if throwErrorOnUnsupportedVctValue is set to false', async () => {
      mockJwtDecode({
        payload: {
          vct: 'IdentityCredential',
        },
      })

      await expect(
        sdJwtVcService.fetchTypeMetadata(
          agent.context,
          {
            payload: {
              vct: 'IdentityCredential',
            },
          } as unknown as SdJwtVc,
          {
            throwErrorOnUnsupportedVctValue: false,
          }
        )
      ).resolves.toBeUndefined()
    })

    test('Fetch type metadata throws error for non-url vct', async () => {
      mockJwtDecode({
        payload: {
          vct: 'IdentityCredential',
        },
      })

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'IdentityCredential',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow("Unable to resolve type metadata for vct 'IdentityCredential'. Only https supported")
    })

    test('Fetch type metadata throws error when both new and legacy paths fail', async () => {
      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(404, 'Not Found')

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(404)

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'https://example.com/credentials/identity',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow(
        "Unable to resolve type metadata vct 'https://example.com/credentials/identity'. Fetch returned a non-successful 404 response. Not Found."
      )
    })

    test('Fetch type metadata throws error when new path throws and legacy path fails', async () => {
      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').replyWithError('Network error')

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(500)

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'https://example.com/credentials/identity',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow(
        "Unable to resolve type metadata vct 'https://example.com/credentials/identity'. Fetch returned a non-successful response."
      )
    })

    test('Fetch type metadata throws error when both paths throw', async () => {
      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').replyWithError('Network error')

      nock('https://example.com').get('/.well-known/vct/credentials/identity').replyWithError('Legacy network error')

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'https://example.com/credentials/identity',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow(
        "Unable to resolve type metadata vct 'https://example.com/credentials/identity'. Fetch returned a non-successful response."
      )
    })

    test('Fetch type metadata with valid vct#integrity (sha256) should succeed', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      // Compute the actual sha256 hash of the metadata
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-256'))
      const integrityMetadata = `sha256-${hash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with valid vct#integrity (sha384) should succeed', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-384'))
      const integrityMetadata = `sha384-${hash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with valid vct#integrity (sha512) should succeed', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-512'))
      const integrityMetadata = `sha512-${hash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with invalid vct#integrity should fail', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      // Use an incorrect hash
      const incorrectHash = 'invalidhash1234567890abcdef='
      const integrityMetadata = `sha256-${incorrectHash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'https://example.com/credentials/identity',
            'vct#integrity': integrityMetadata,
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow('Integrity check failed. None of the provided hashes match the computed hash for the response.')
    })

    test('Fetch type metadata with multiple integrity values (strongest algorithm wins)', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const sha256Hash = TypedArrayEncoder.toBase64(
        Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-256')
      )
      const sha512Hash = TypedArrayEncoder.toBase64(
        Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-512')
      )
      // Provide both sha256 and sha512, the verifier should use sha512 as it's stronger
      const integrityMetadata = `sha256-${sha256Hash} sha512-${sha512Hash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with invalid vct#integrity type (non-string) should fail', async () => {
      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': 12345,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(
        200,
        {},
        {
          'Content-Type': 'application/json',
        }
      )
      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'https://example.com/credentials/identity',
            'vct#integrity': 12345,
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow("Found 'vct#integrity' with value '12345' but value was not of type 'string'.")
    })

    test('Fetch type metadata with vct#integrity where only sha256 is wrong but sha512 is correct', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const incorrectSha256Hash = 'invalidhash1234567890abcdef='
      const sha512Hash = TypedArrayEncoder.toBase64(
        Hasher.hash(TypedArrayEncoder.fromUtf8String(metadataJson), 'sha-512')
      )
      // sha512 is stronger and correct, so it should succeed even if sha256 is wrong
      const integrityMetadata = `sha256-${incorrectSha256Hash} sha512-${sha512Hash}`

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with custom resolver for non-https vct', async () => {
      const mockMetadata = {
        vct: 'urn:custom:namespace:identity',
        name: 'Custom Identity Credential',
        description: 'A custom credential type',
      }

      const customResolver = vi.fn((async (vct, integrity, options) => {
        if (vct === 'urn:custom:namespace:identity') {
          return mockMetadata
        }
        throw new Error('Unsupported vct')
      }) satisfies CustomTypeMetadataResolver)

      mockJwtDecode({
        payload: {
          vct: 'urn:custom:namespace:identity',
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'urn:custom:namespace:identity',
        },
      } as unknown as SdJwtVc)

      expect(customResolver).toHaveBeenCalledWith(
        'urn:custom:namespace:identity',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
          defaultResolver: expect.any(Function),
        })
      )

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['urn:custom:namespace:identity'],
      })
    })

    test('Fetch type metadata with custom resolver that uses default resolver for https URLs', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const customResolver = vi.fn((async (vct, integrity, options) => {
        // Use default resolver for HTTPS URLs
        if (vct.startsWith('https://')) {
          return options.defaultResolver({})
        }
        throw new Error('Unsupported vct')
      }) satisfies CustomTypeMetadataResolver)

      mockJwtDecode({
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      })

      nock('https://example.com').get('/credentials/identity').reply(200, mockMetadata)

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(customResolver).toHaveBeenCalledWith(
        'https://example.com/credentials/identity',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
          defaultResolver: expect.any(Function),
        })
      )

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['https://example.com/credentials/identity'],
      })
    })

    test('Fetch type metadata with custom resolver and extends field', async () => {
      const baseMetadata = {
        vct: 'urn:base:credential',
        name: 'Base Credential',
        claims: [{ path: ['claim1'] }],
      }

      const extendedMetadata = {
        vct: 'urn:extended:credential',
        name: 'Extended Credential',
        extends: 'urn:base:credential',
        claims: [{ path: ['claim2'] }],
      }

      const customResolver = vi.fn(async (vct: string, _integrity, _options) => {
        if (vct === 'urn:extended:credential') {
          return extendedMetadata
        }
        if (vct === 'urn:base:credential') {
          return baseMetadata
        }
        throw new Error('Unsupported vct')
      })

      mockJwtDecode({
        payload: {
          vct: 'urn:extended:credential',
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'urn:extended:credential',
        },
      } as unknown as SdJwtVc)

      // Should be called twice: once for the extended vct, once for the base vct
      expect(customResolver).toHaveBeenCalledTimes(2)
      expect(customResolver).toHaveBeenCalledWith(
        'urn:extended:credential',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
        })
      )
      expect(customResolver).toHaveBeenCalledWith(
        'urn:base:credential',
        undefined,
        expect.objectContaining({
          isExtendedVct: true,
        })
      )

      expect(result?.vctValues).toEqual(['urn:extended:credential', 'urn:base:credential'])
      expect(result?.typeMetadataChain).toEqual([extendedMetadata, baseMetadata])
      // Merged metadata should combine claims from both
      expect(result?.mergedTypeMetadata.claims).toHaveLength(2)
    })

    test('Fetch type metadata with custom resolver that throws error', async () => {
      const customResolver = vi.fn(async (_vct: string, _integrity, _options) => {
        throw new Error('Custom resolver error')
      })

      mockJwtDecode({
        payload: {
          vct: 'urn:custom:namespace:identity',
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'urn:custom:namespace:identity',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow('Custom resolver error')

      expect(customResolver).toHaveBeenCalledWith(
        'urn:custom:namespace:identity',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
        })
      )
    })

    test('Fetch type metadata with custom resolver that returns undefined for non-extended vct', async () => {
      const customResolver = vi.fn((async (vct, integrity, options) => {
        // Only return undefined if not extended (as extended vcts must return a value)
        if (!options.isExtendedVct && !options.throwErrorOnUnsupportedVctValue) {
          return undefined
        }

        throw new Error('Unsupported vct')
      }) satisfies CustomTypeMetadataResolver)

      mockJwtDecode({
        payload: {
          vct: 'urn:custom:namespace:identity',
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(
        agent.context,
        {
          payload: {
            vct: 'urn:custom:namespace:identity',
          },
        } as unknown as SdJwtVc,
        {
          throwErrorOnUnsupportedVctValue: false,
        }
      )

      expect(customResolver).toHaveBeenCalledWith(
        'urn:custom:namespace:identity',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
        })
      )

      expect(result).toBeUndefined()
    })

    test('Fetch type metadata with custom resolver handling integrity', async () => {
      const mockMetadata = {
        vct: 'urn:custom:namespace:identity',
        name: 'Custom Identity Credential',
      }

      const customIntegrity = 'sha256-abc123'

      const customResolver = vi.fn(async (_vct: string, integrity: string | undefined, _options) => {
        expect(integrity).toBe(customIntegrity)
        return mockMetadata
      })

      mockJwtDecode({
        payload: {
          vct: 'urn:custom:namespace:identity',
          'vct#integrity': customIntegrity,
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'urn:custom:namespace:identity',
          'vct#integrity': customIntegrity,
        },
      } as unknown as SdJwtVc)

      expect(customResolver).toHaveBeenCalledWith('urn:custom:namespace:identity', customIntegrity, expect.any(Object))

      expect(result).toEqual({
        mergedTypeMetadata: mockMetadata,
        typeMetadataChain: [mockMetadata],
        vctValues: ['urn:custom:namespace:identity'],
      })
    })

    test('Fetch type metadata with custom resolver respecting throwErrorOnUnsupportedVctValue option', async () => {
      const customResolver = vi.fn((async (vct, integrity, options) => {
        if (!options.throwErrorOnUnsupportedVctValue) {
          return undefined
        }
        throw new Error('Unsupported vct')
      }) satisfies CustomTypeMetadataResolver)

      mockJwtDecode({
        payload: {
          vct: 'urn:unsupported',
        },
      })

      const customConfig = new SdJwtVcModuleConfig({ customTypeMetadataResolver: customResolver })
      agent.context.dependencyManager.registerInstance(SdJwtVcModuleConfig, customConfig)

      const result = await sdJwtVcService.fetchTypeMetadata(
        agent.context,
        {
          payload: {
            vct: 'urn:unsupported',
          },
        } as unknown as SdJwtVc,
        {
          throwErrorOnUnsupportedVctValue: false,
        }
      )

      expect(customResolver).toHaveBeenCalledWith(
        'urn:unsupported',
        undefined,
        expect.objectContaining({
          isExtendedVct: false,
          defaultResolver: expect.any(Function),
        })
      )

      expect(result).toBeUndefined()
    })
  })
})
