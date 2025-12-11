import type { AgentContext, Constructable, SdJwtVc } from '@credo-ts/core'
import {
  Agent,
  DidKey,
  DidsModule,
  getDomainFromUrl,
  Hasher,
  JwsService,
  JwtPayload,
  KeyDidRegistrar,
  KeyDidResolver,
  parseDid,
  TypedArrayEncoder,
  X509Certificate,
  X509ModuleConfig,
} from '@credo-ts/core'
import { createHeaderAndPayload, StatusList } from '@sd-jwt/jwt-status-list'
import { SDJWTException } from '@sd-jwt/utils'
import { randomUUID } from 'crypto'
import nock from 'nock'
import { vi } from 'vitest'
import { transformSeedToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions } from '../../../../tests'
import { PublicJwk } from '../../kms'
import { SdJwtVcRecord, SdJwtVcRepository } from '../repository'
import type { SdJwtVcHeader } from '../SdJwtVcOptions'
import { SdJwtVcService } from '../SdJwtVcService'
import {
  complexSdJwtVc,
  complexSdJwtVcPresentation,
  contentChangedSdJwtVc,
  expiredSdJwtVc,
  funkeX509,
  notBeforeInFutureSdJwtVc,
  sdJwtVcPid,
  sdJwtVcWithSingleDisclosure,
  sdJwtVcWithSingleDisclosurePresentation,
  signatureInvalidSdJwtVc,
  simpleJwtVc,
  simpleJwtVcPresentation,
  simpleJwtVcWithoutHolderBinding,
  simpleSdJwtVcWithStatus,
  simpleX509,
  simpleX509WithoutIss,
} from './sdjwtvc.fixtures'

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

agent.kms.randomBytes = vi.fn(function () {
  return TypedArrayEncoder.fromString('salt')
})
Date.prototype.getTime = vi.fn(function () {
  return 1698151532000
})
Date.now = vi.fn(function () {
  return 1698151532000
})

const simpleX509Certificate = X509Certificate.fromEncodedCertificate(simpleX509.trustedCertificate)

const generateStatusList = async (
  agentContext: AgentContext,
  key: PublicJwk,
  issuerDidUrl: string,
  length: number,
  revokedIndexes: number[]
): Promise<string> => {
  const statusList = new StatusList(
    Array.from({ length }, (_, i) => (revokedIndexes.includes(i) ? 1 : 0)),
    1
  )

  const [did, keyId] = issuerDidUrl.split('#')
  const { header, payload } = createHeaderAndPayload(
    statusList,
    {
      iss: did,
      sub: 'https://example.com/status/1',
      iat: Date.now() / 1000,
    },
    {
      alg: 'EdDSA',
      typ: 'statuslist+jwt',
      kid: `#${keyId}`,
    }
  )

  const jwsService = agentContext.dependencyManager.resolve(JwsService)
  return jwsService.createJwsCompact(agentContext, {
    keyId: key.keyId,
    payload: JwtPayload.fromJson(payload),
    protectedHeaderOptions: {
      ...header,
      alg: 'EdDSA',
    },
  })
}

describe('SdJwtVcService', () => {
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  let issuerDidUrl: string
  let issuerKey: PublicJwk
  let holderKey: PublicJwk
  let sdJwtVcService: SdJwtVcService

  afterEach(() => {
    nock.cleanAll()
  })

  beforeAll(async () => {
    await agent.initialize()

    const issuerPrivateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000000'),
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
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000001'),
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
    test('Sign (x509) sd-jwt-vc with an invalid certificate issuer should fail', async () => {
      await expect(
        sdJwtVcService.sign(agent.context, {
          payload: {
            claim: 'some-claim',
            vct: 'IdentityCredential',
          },
          holder: {
            method: 'jwk',
            jwk: holderKey,
          },
          issuer: {
            method: 'x5c',
            x5c: [simpleX509Certificate],
            issuer: 'some-issuer',
          },
        })
      ).rejects.toThrow()
    })

    test('Sign (x509) sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'x5c',
          x5c: [simpleX509Certificate],
          issuer: simpleX509.certificateIssuer,
        },
        headerType: 'vc+sd-jwt',
      })

      expect(compact).toStrictEqual(simpleX509.sdJwtVc)

      const sdJwtVc = sdJwtVcService.fromCompact(compact)
      expect(sdJwtVc.header).toEqual({
        typ: 'vc+sd-jwt',
        alg: 'EdDSA',
        x5c: [simpleX509.trustedCertificate],
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: simpleX509.certificateIssuer,
        cnf: { jwk: holderKey.toJson() },
      })
    })

    test('Sign (x509) sd-jwt-vc without issuer claim', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'x5c',
          x5c: [simpleX509Certificate],
        },
      })

      expect(compact).toStrictEqual(simpleX509WithoutIss.sdJwtVc)

      const sdJwtVc = sdJwtVcService.fromCompact(compact)
      expect(sdJwtVc.header).toEqual({
        typ: 'dc+sd-jwt',
        alg: 'EdDSA',
        x5c: [simpleX509WithoutIss.trustedCertificate],
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: undefined,
        cnf: { jwk: holderKey.toJson() },
      })
    })

    test('Sign sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
        headerType: 'vc+sd-jwt',
      })

      expect(compact).toStrictEqual(simpleJwtVc)

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
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })

    test('Sign sd-jwt-vc from a basic payload without holder binding', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
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

    test('Sign sd-jwt-vc from a basic payload including false boolean values', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          value: false,
          discloseableValue: false,
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      const sdJwtVc = sdJwtVcService.fromCompact(compact)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'dc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: parseDid(issuerDidUrl).did,
        value: false,
        discloseableValue: false,
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with a disclosure', async () => {
      const { compact, header, prettyClaims, payload } = await sdJwtVcService.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential' },
        disclosureFrame: { _sd: ['claim'] },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
        headerType: 'vc+sd-jwt',
      })

      expect(compact).toStrictEqual(sdJwtVcWithSingleDisclosure)

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: issuerDidUrl.split('#')[0],
        _sd: ['LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: issuerDidUrl.split('#')[0],
        claim: 'some-claim',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const { compact, header, payload, prettyClaims } = await sdJwtVcService.sign(agent.context, {
        disclosureFrame: {
          _sd: ['is_over_65', 'is_over_21', 'is_over_18', 'birthdate', 'email', 'given_name'],
          address: {
            _sd: ['region', 'country'],
          },
        },
        payload: {
          vct: 'IdentityCredential',
          given_name: 'John',
          family_name: 'Doe',
          email: 'johndoe@example.com',
          phone_number: '+1-202-555-0101',
          address: {
            street_address: '123 Main St',
            locality: 'Anytown',
            region: 'Anystate',
            country: 'US',
          },
          birthdate: '1940-01-01',
          is_over_18: true,
          is_over_21: true,
          is_over_65: true,
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
        headerType: 'vc+sd-jwt',
      })

      expect(compact).toStrictEqual(complexSdJwtVc)

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        address: {
          _sd: ['8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY', 'cxH6g51BOh8vDiQXW88Kq896DEVLZZ4mbuLO6z__5ds'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        _sd: [
          '1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE',
          '2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw',
          'hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM',
          'jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs',
          'lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY',
          'sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A',
        ],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        address: {
          region: 'Anystate',
          country: 'US',
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        email: 'johndoe@example.com',
        given_name: 'John',
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with multiple (nested) disclosure where a disclosure contains other disclosures', async () => {
      const { header, payload, prettyClaims } = await sdJwtVcService.sign(agent.context, {
        disclosureFrame: {
          _sd: ['is_over_65', 'is_over_21', 'is_over_18', 'birthdate', 'email', 'given_name', 'address'],
          address: {
            _sd: ['region', 'country'],
          },
        },
        payload: {
          vct: 'IdentityCredential',
          given_name: 'John',
          family_name: 'Doe',
          email: 'johndoe@example.com',
          phone_number: '+1-202-555-0101',
          address: {
            street_address: '123 Main St',
            locality: 'Anytown',
            region: 'Anystate',
            country: 'US',
          },
          birthdate: '1940-01-01',
          is_over_18: true,
          is_over_21: true,
          is_over_65: true,
        },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'dc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        _sd: [
          '1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE',
          '2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw',
          'RDQeb-TXvRaGsX5jV4W2-xAKutsaYZVm8qEvMtP71pc',
          'hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM',
          'jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs',
          'lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY',
          'sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A',
        ],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        address: {
          region: 'Anystate',
          country: 'US',
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        email: 'johndoe@example.com',
        given_name: 'John',
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })
  })

  describe('SdJwtVcService.receive', () => {
    test('Receive sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwtVc = sdJwtVcService.fromCompact(simpleJwtVc)
      const sdJwtVcRecord = await sdJwtVcService.store(agent.context, {
        record: new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: simpleJwtVc,
            },
          ],
        }),
      })
      expect(sdJwtVcRecord.encoded).toEqual(simpleJwtVc)

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
        cnf: {
          jwk: holderKey.toJson(),
        },
      })
    })

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

    test('Receive sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwtVc = sdJwtVcService.fromCompact(sdJwtVcWithSingleDisclosure)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        iss: issuerDidUrl.split('#')[0],
        _sd: ['LHLZVlumA3_k-zntrSL6ocULVh_uz0PQoupZS4hu15M'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      expect(sdJwtVc.payload).not.toHaveProperty('claim')
    })

    test('Receive sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwtVc = sdJwtVcService.fromCompact(complexSdJwtVc)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        address: {
          _sd: ['8Kl-6KGl7JjFrlN0ZKDPKzeRfo0oJ5Tv0F6cXgpmOCY', 'cxH6g51BOh8vDiQXW88Kq896DEVLZZ4mbuLO6z__5ds'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        _sd_alg: 'sha-256',
        phone_number: '+1-202-555-0101',
        _sd: [
          '1oLbHVhfmVs2oA3vhFNTXhMw4lGu7ql9dZ0T7p-vWqE',
          '2xuzS3kUrT6VPJD-MySIkQ47HIB-gcyzF5NDY19cPBw',
          'hn1gcrO_Q2HskW2Z_nzIrIl6KpgqldvScozutJdbhWM',
          'jc73t3yBoDs_pDYb03lEYKYvCbtCq9NhuJ6_5A7QNSs',
          'lKI_sY05pDIs9MDrjCO4v8XoDM963JXxrp9T2FNLyTY',
          'sl0hkY5LeVwy3rIjNaCl4P4CJ3C3v8Ip-GH2lB9Sd_A',
        ],
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      const unwantedKeys = [
        'address.region',
        'address.country',
        'email',
        'given_name',
        'birthdate',
        'is_over_18',
        'is_over_21',
        'is_over_65',
      ]
      for (const key of unwantedKeys) {
        expect(sdJwtVc.payload).not.toHaveProperty(key)
      }

      expect(sdJwtVc.prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        phone_number: '+1-202-555-0101',
        email: 'johndoe@example.com',
        given_name: 'John',
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
        address: {
          region: 'Anystate',
          country: 'US',
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        cnf: {
          jwk: holderKey.toJson(),
        },
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

    test('Supports payload that results in no disclosures', async () => {
      const presentation = sdJwtVcService.applyDisclosuresForPayload(simpleJwtVc, {
        claim: 'some-claim',
      })

      expect(presentation.prettyClaims).toStrictEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        cnf: {
          jwk: {
            kty: 'OKP',
            crv: 'Ed25519',
            kid: 'BnbnQW5VWoys6x6qYxEUVrEKGYW2GS5vG71vCMwwfsYm',
            x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
          },
        },
        iss: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
        iat: 1698151532,
      })

      expect(presentation.compact).toEqual(simpleJwtVc)
    })
  })

  describe('SdJwtVcService.present', () => {
    test('Present sd-jwt-vc from a basic payload without disclosures', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleJwtVc,
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
      })

      expect(presentation).toStrictEqual(simpleJwtVcPresentation)
    })

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

    test('Present sd-jwt-vc from a basic payload with a disclosure', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: sdJwtVcWithSingleDisclosure,
        presentationFrame: { claim: true },
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
      })

      expect(presentation).toStrictEqual(sdJwtVcWithSingleDisclosurePresentation)
    })

    test('Present sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const presentation = await sdJwtVcService.present<{
        is_over_65: boolean
        is_over_21: boolean
        email: boolean
        address: { country: string }
        given_name: boolean
      }>(agent.context, {
        sdJwtVc: complexSdJwtVc,
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
        presentationFrame: {
          is_over_65: true,
          is_over_21: true,
          email: true,
          address: {
            country: true,
          },
          given_name: true,
        },
      })

      expect(presentation).toStrictEqual(complexSdJwtVcPresentation)
    })
  })

  describe('SdJwtVcService.verify', () => {
    test('Verify sd-jwt-vc without disclosures', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleJwtVc,
        // no disclosures
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify x509 protected sd-jwt-vc without disclosures', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleX509.sdJwtVc,
        // no disclosures
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
      })

      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      x509ModuleConfig.addTrustedCertificate(simpleX509.trustedCertificate)

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify x509 protected sd-jwt-vc without iss', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: simpleX509WithoutIss.sdJwtVc,
        // no disclosures
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
      })

      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      x509ModuleConfig.addTrustedCertificate(simpleX509WithoutIss.trustedCertificate)

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['claim'],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

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

    test('Verify x509 chain protected sd-jwt-vc', async () => {
      const x509ModuleConfig = agent.context.dependencyManager.resolve(X509ModuleConfig)
      x509ModuleConfig.addTrustedCertificate(funkeX509.trustedCertificate)

      Date.prototype.getTime = vi.fn(function () {
        return 1717498204 * 1000
      })
      Date.now = vi.fn(function () {
        return 1717498204 * 1000
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: funkeX509.sdJwtVc,
        requiredClaimKeys: ['issuing_country'],
      })

      Date.prototype.getTime = vi.fn(function () {
        return 1698151532000
      })
      Date.now = vi.fn(function () {
        return 1698151532000
      })

      const sdJwtIss = verificationResult.sdJwtVc?.payload.iss
      expect(sdJwtIss).toEqual('https://demo.pid-issuer.bundesdruckerei.de/c')
      expect(getDomainFromUrl(sdJwtIss as string)).toEqual('demo.pid-issuer.bundesdruckerei.de')

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
        error: new SDJWTException('Status is not valid'),
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

    test('Verify sd-jwt-vc with a disclosure', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        sdJwtVc: sdJwtVcWithSingleDisclosure,
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
        presentationFrame: { claim: true },
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        requiredClaimKeys: ['vct', 'cnf', 'claim', 'iat'],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify sd-jwt-vc with multiple (nested) disclosure', async () => {
      const presentation = await sdJwtVcService.present<{
        is_over_65: boolean
        is_over_21: boolean
        email: boolean
        address: { country: string }
        given_name: boolean
      }>(agent.context, {
        sdJwtVc: complexSdJwtVc,
        verifierMetadata: {
          issuedAt: Date.now() / 1000,
          audience: verifierDid,
          nonce: 'salt',
        },
        presentationFrame: {
          is_over_65: true,
          is_over_21: true,
          email: true,
          address: {
            country: true,
          },
          given_name: true,
        },
      })

      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: 'salt' },
        // FIXME: this should be a requiredFrame to be consistent with the other methods
        // using frames
        requiredClaimKeys: [
          'vct',
          'family_name',
          'phone_number',
          'address',
          'cnf',
          'iss',
          'iat',
          'is_over_65',
          'is_over_21',
          'email',
          'given_name',
          'address.street_address',
          'address.locality',
          'address.country',
        ],
      })

      expect(verificationResult).toEqual({
        isValid: true,
        sdJwtVc: expect.any(Object),
      })
    })

    test('Verify did holder-bound sd-jwt-vc with disclosures and kb-jwt', async () => {
      const verificationResult = await sdJwtVcService.verify<SdJwtVcHeader, { address: { country: string } }>(
        agent.context,
        {
          compactSdJwtVc:
            'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJPcGVuQmFkZ2VDcmVkZW50aWFsIiwiZGVncmVlIjoiYmFjaGVsb3IiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyJLbE5PM0VfYjRmdUwyOUd2QXdwTGczTGZHZTlxdDdhakUxMzlfU1pIbWk4Il0sIl9zZF9hbGciOiJzaGEtMjU2In0.TBWIECIMmNKNqVtjwHARSnR0Ii9Fefy871sXEK-zfThbTBALdvXBTBQ6iKvvI-CxsniSH1hJMEJTu1vK7esTDg~WyJzYWx0IiwidW5pdmVyc2l0eSIsImlubnNicnVjayJd~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiODlyX3JrSjdvb3RuSGJ3TXdjMW9sNzZncU03WU1zNVUzVnpkMHN6N3VkbyJ9.VkrxL06aP8t-G_lVtlAZNgJC2gouqR__rXDgJQPParq5OGxna3ZoQQbjv7e3I2TUaVaMV6xUpJY1KufZlPDwAg',
          keyBinding: {
            audience: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y',
            nonce: 'salt',
          },
        }
      )

      expect(verificationResult.isValid).toBe(true)
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
        error: new SDJWTException('Verify Error: JWT is expired'),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with nbf in future and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: notBeforeInFutureSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: new SDJWTException('Verify Error: JWT is not yet valid'),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with content changed and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: contentChangedSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: new SDJWTException('Verify Error: Invalid JWT Signature'),
        sdJwtVc: expect.any(Object),
      })
    })

    test('verify sd-jwt-vc with invalid signature and fails', async () => {
      const verificationResult = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: signatureInvalidSdJwtVc,
      })

      expect(verificationResult).toEqual({
        isValid: false,
        error: new SDJWTException('Verify Error: Invalid JWT Signature'),
        sdJwtVc: expect.any(Object),
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

      nock('https://example.com').get('/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata from legacy vct URL path when new path fails', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      nock('https://example.com').get('/credentials/identity').reply(404)

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata from legacy vct URL path when new path throws error', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
        description: 'A credential for identity verification',
      }

      nock('https://example.com').get('/credentials/identity').replyWithError('CORS error')

      nock('https://example.com').get('/.well-known/vct/credentials/identity').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata with nested path', async () => {
      const mockMetadata = {
        vct: 'https://example.com/v1/credentials/identity/verified',
        name: 'Verified Identity Credential',
      }

      nock('https://example.com').get('/v1/credentials/identity/verified').reply(404)

      nock('https://example.com').get('/.well-known/vct/v1/credentials/identity/verified').reply(200, mockMetadata)

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/v1/credentials/identity/verified',
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata throws error for non-https vct', async () => {
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
      await expect(
        sdJwtVcService.fetchTypeMetadata(agent.context, {
          payload: {
            vct: 'IdentityCredential',
          },
        } as unknown as SdJwtVc)
      ).rejects.toThrow("Unable to resolve type metadata for vct 'IdentityCredential'. Only https supported")
    })

    test('Fetch type metadata throws error when both new and legacy paths fail', async () => {
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
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-256'))
      const integrityMetadata = `sha256-${hash}`

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata with valid vct#integrity (sha384) should succeed', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-384'))
      const integrityMetadata = `sha384-${hash}`

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata with valid vct#integrity (sha512) should succeed', async () => {
      const mockMetadata = {
        vct: 'https://example.com/credentials/identity',
        name: 'Identity Credential',
      }

      const metadataJson = JSON.stringify(mockMetadata)
      const hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-512'))
      const integrityMetadata = `sha512-${hash}`

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
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
      const sha256Hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-256'))
      const sha512Hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-512'))
      // Provide both sha256 and sha512, the verifier should use sha512 as it's stronger
      const integrityMetadata = `sha256-${sha256Hash} sha512-${sha512Hash}`

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })

    test('Fetch type metadata with invalid vct#integrity type (non-string) should fail', async () => {
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
      const sha512Hash = TypedArrayEncoder.toBase64(Hasher.hash(TypedArrayEncoder.fromString(metadataJson), 'sha-512'))
      // sha512 is stronger and correct, so it should succeed even if sha256 is wrong
      const integrityMetadata = `sha256-${incorrectSha256Hash} sha512-${sha512Hash}`

      nock('https://example.com').get('/credentials/identity').reply(200, metadataJson, {
        'Content-Type': 'application/json',
      })

      const result = await sdJwtVcService.fetchTypeMetadata(agent.context, {
        payload: {
          vct: 'https://example.com/credentials/identity',
          'vct#integrity': integrityMetadata,
        },
      } as unknown as SdJwtVc)

      expect(result).toEqual(mockMetadata)
    })
  })
})
