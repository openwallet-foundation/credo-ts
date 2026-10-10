import { Hasher, parseDid, TypedArrayEncoder } from '@credo-ts/core'
import { vi } from 'vitest'
import { PublicJwk } from '../../kms'
import { SdJwtVcRecord } from '../repository'
import type { SdJwtVcHeader, SdJwtVcPayload } from '../SdJwtVcOptions'
import { createHolderBindingTestSetup } from './holderBindingTestSetup'
import {
  complexSdJwtVc,
  complexSdJwtVcPresentation,
  sdJwtVcWithSingleDisclosure,
  sdJwtVcWithSingleDisclosurePresentation,
  simpleJwtVc,
  simpleJwtVcPresentation,
} from './sdjwtvc.fixtures'

describe('SdJwtVcService JWK holder binding (cnf.jwk)', () => {
  let setup: Awaited<ReturnType<typeof createHolderBindingTestSetup>>
  let agent: typeof setup.agent
  let sdJwtVcService: typeof setup.service
  let issuerDidUrl: string
  let holderKey: PublicJwk
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  const staticSalt = () => TypedArrayEncoder.fromUtf8String('salt')
  const mockUniqueSalts = () => {
    let counter = 0
    vi.mocked(agent.kms.randomBytes).mockImplementation(() => TypedArrayEncoder.fromUtf8String(`salt${counter++}`))
  }

  beforeAll(async () => {
    setup = await createHolderBindingTestSetup('sdjwtvc-jwk-holder')
    agent = setup.agent
    sdJwtVcService = setup.service
    issuerDidUrl = setup.issuer.didUrl
    holderKey = setup.holder.key
    agent.kms.randomBytes = vi.fn(staticSalt)
    Date.prototype.getTime = vi.fn(() => 1698151532 * 1000)
    Date.now = vi.fn(() => 1698151532 * 1000)
  })

  afterEach(() => {
    vi.mocked(agent.kms.randomBytes).mockImplementation(staticSalt)
  })

  describe('SdJwtVcService.sign', () => {
    test('Sign sd-jwt-vc with iat explicitly set to null should not include iat in the issued credential', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          iat: null,
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

      expect(sdJwtVc.payload).not.toHaveProperty('iat')
      expect(sdJwtVc.prettyClaims).not.toHaveProperty('iat')
      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iss: parseDid(issuerDidUrl).did,
        cnf: { jwk: holderKey.toJson() },
      })
    })

    test('Sign sd-jwt-vc with iat in payload should preserve the provided iat value', async () => {
      const customIat = 1700000000

      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          iat: customIat,
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
      expect(sdJwtVc.payload.iat).toEqual(customIat)
    })

    test('Sign sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          iat: Math.floor(Date.now() / 1000),
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

    test('Sign sd-jwt-vc from a basic payload including false boolean values', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
          value: false,
          discloseableValue: false,
          iat: Math.floor(Date.now() / 1000),
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
        payload: { claim: 'some-claim', vct: 'IdentityCredential', iat: Math.floor(Date.now() / 1000) },
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

    test('Create sd-jwt-vc with a hashing algorithm other than sha-256', async () => {
      const iat = 1698151532
      const { compact, payload, prettyClaims } = await sdJwtVcService.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential', iat },
        disclosureFrame: { _sd: ['claim'] },
        holder: {
          method: 'jwk',
          jwk: holderKey,
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
        hashingAlgorithm: 'sha-512',
      })

      const [, encodedDisclosure] = compact.split('~')

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat,
        iss: issuerDidUrl.split('#')[0],
        _sd: [TypedArrayEncoder.toBase64Url(Hasher.hash(encodedDisclosure, 'sha-512'))],
        _sd_alg: 'sha-512',
        cnf: {
          jwk: holderKey.toJson(),
        },
      })

      // The digests must be resolvable using the algorithm from `_sd_alg`
      expect(prettyClaims.claim).toStrictEqual('some-claim')
      expect(sdJwtVcService.fromCompact(compact).prettyClaims.claim).toStrictEqual('some-claim')
    })

    test('Create sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      mockUniqueSalts()
      const { header, payload, prettyClaims } = await sdJwtVcService.sign(agent.context, {
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
          iat: Math.floor(Date.now() / 1000),
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

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(Date.now() / 1000),
        address: {
          _sd: ['-5id9AETSlfSgueABbi7AxNO_jMnixiMAK0Y-RFSg1M', 'k1UUbHcbyjSI3lqKAIUXdqgVrVA8W_SlgPmL0DGSvcA'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        _sd: [
          'GRuP81jhLKxUXmVTvd_wNCdbIoc_mxx75PNavKn_XKI',
          'OXrkrM39EeoiWKZMLCOJxzImLUseRo9kdUgQfeOSnEQ',
          'YrwUmkjIZz4ZRW1vfPvMunqKaEn-bCpSFEJO-RFwVTs',
          'gjCZSKGwu9bO3mqnBVfhakDSzFrKhfeWWrhZpcnZLzo',
          'o1MzUdDNDx5gOAW2FaaVhGald8-3Jb4A6S_FBhzn5zk',
          'ws7qipcgSSOKTtgPFd7u0fwpOLoK4rIKgGqQoM1ORi0',
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
      mockUniqueSalts()
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
          iat: Math.floor(Date.now() / 1000),
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
          'LYk_sFxcqWbJvdoB_qrXkMRJwu3FafsVe_1RJwz3L-8',
          'SUShCtoCQQ_YUfyfmhSKwqyQHjqH1X9ZiurnWNvfHI4',
          'YrwUmkjIZz4ZRW1vfPvMunqKaEn-bCpSFEJO-RFwVTs',
          'gjCZSKGwu9bO3mqnBVfhakDSzFrKhfeWWrhZpcnZLzo',
          'hu-enwvnFozp9eH1NTcQnl_g3-gqlmHRBFD8lreDM4s',
          'keoVRCHpUVfOQEma48MMA0sYCjox8yS2IPEc9MQgzGM',
          'mvwvkBPwUX28Bm8dwhDHyXT9_SeLsPHPPUFMSTAyRK4',
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
      const presentation = await sdJwtVcService.present<
        {
          is_over_65: boolean
          is_over_21: boolean
          email: boolean
          address: { country: string }
          given_name: boolean
        } & SdJwtVcPayload
      >(agent.context, {
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
      const presentation = await sdJwtVcService.present<
        {
          is_over_65: boolean
          is_over_21: boolean
          email: boolean
          address: { country: string }
          given_name: boolean
        } & SdJwtVcPayload
      >(agent.context, {
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

    test('Verify cnf.jwk holder-bound sd-jwt-vc with disclosures and kb-jwt', async () => {
      const verificationResult = await sdJwtVcService.verify<
        SdJwtVcHeader,
        { address: { country: string } } & SdJwtVcPayload
      >(agent.context, {
        compactSdJwtVc:
          'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSIsImtpZCI6IiN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlcifQ.eyJ2Y3QiOiJPcGVuQmFkZ2VDcmVkZW50aWFsIiwiZGVncmVlIjoiYmFjaGVsb3IiLCJjbmYiOnsiandrIjp7Imt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLCJ4Ijoib0VOVnN4T1VpSDU0WDh3SkxhVmtpY0NSazAwd0JJUTRzUmdiazU0TjhNbyJ9fSwiaXNzIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZCI6WyJLbE5PM0VfYjRmdUwyOUd2QXdwTGczTGZHZTlxdDdhakUxMzlfU1pIbWk4Il0sIl9zZF9hbGciOiJzaGEtMjU2In0.TBWIECIMmNKNqVtjwHARSnR0Ii9Fefy871sXEK-zfThbTBALdvXBTBQ6iKvvI-CxsniSH1hJMEJTu1vK7esTDg~WyJzYWx0IiwidW5pdmVyc2l0eSIsImlubnNicnVjayJd~eyJ0eXAiOiJrYitqd3QiLCJhbGciOiJFZERTQSJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkiLCJzZF9oYXNoIjoiODlyX3JrSjdvb3RuSGJ3TXdjMW9sNzZncU03WU1zNVUzVnpkMHN6N3VkbyJ9.VkrxL06aP8t-G_lVtlAZNgJC2gouqR__rXDgJQPParq5OGxna3ZoQQbjv7e3I2TUaVaMV6xUpJY1KufZlPDwAg',
        keyBinding: {
          audience: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y',
          nonce: 'salt',
        },
      })

      expect(verificationResult.isValid).toBe(true)
    })
  })

  describe('SdJwtVcService.disclose', () => {
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
})
