import type { SdJwtVcHeader } from '../SdJwtVcOptions'
import type { Jwk, Key } from '@credo-ts/core'

import { getInMemoryAgentOptions } from '../../../../tests'
import { SdJwtVcService } from '../SdJwtVcService'
import { SdJwtVcRepository } from '../repository'

import {
  complexSdJwtVc,
  complexSdJwtVcPresentation,
  sdJwtVcWithSingleDisclosure,
  sdJwtVcWithSingleDisclosurePresentation,
  simpleJwtVc,
  simpleJwtVcPresentation,
} from './sdjwtvc.fixtures'

import {
  parseDid,
  getJwkFromKey,
  DidKey,
  DidsModule,
  KeyDidRegistrar,
  KeyDidResolver,
  KeyType,
  Agent,
  TypedArrayEncoder,
} from '@credo-ts/core'

const jwkJsonWithoutUse = (jwk: Jwk) => {
  const jwkJson = jwk.toJson()
  delete jwkJson.use
  return jwkJson
}

const agent = new Agent(
  getInMemoryAgentOptions(
    'sdjwtvcserviceagent',
    {},
    {
      dids: new DidsModule({
        resolvers: [new KeyDidResolver()],
        registrars: [new KeyDidRegistrar()],
      }),
    }
  )
)

agent.context.wallet.generateNonce = jest.fn(() => Promise.resolve('salt'))
Date.prototype.getTime = jest.fn(() => 1698151532000)

jest.mock('../repository/SdJwtVcRepository')
const SdJwtVcRepositoryMock = SdJwtVcRepository as jest.Mock<SdJwtVcRepository>

describe('SdJwtVcService', () => {
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  let issuerDidUrl: string
  let issuerKey: Key
  let holderKey: Key
  let sdJwtVcService: SdJwtVcService

  beforeAll(async () => {
    await agent.initialize()

    issuerKey = await agent.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000000'),
    })

    const issuerDidKey = new DidKey(issuerKey)
    const issuerDidDocument = issuerDidKey.didDocument
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({ didDocument: issuerDidDocument, did: issuerDidDocument.id })

    holderKey = await agent.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000001'),
    })

    const holderDidKey = new DidKey(holderKey)
    const holderDidDocument = holderDidKey.didDocument
    await agent.dids.import({ didDocument: holderDidDocument, did: holderDidDocument.id })

    const sdJwtVcRepositoryMock = new SdJwtVcRepositoryMock()
    sdJwtVcService = new SdJwtVcService(sdJwtVcRepositoryMock)
  })

  describe('SdJwtVcService.sign', () => {
    test('Sign sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact } = await sdJwtVcService.sign(agent.context, {
        payload: {
          claim: 'some-claim',
          vct: 'IdentityCredential',
        },
        holder: {
          // FIXME: is it nicer API to just pass either didUrl or JWK?
          // Or none if you don't want to bind it?
          method: 'jwk',
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(compact).toStrictEqual(simpleJwtVc)

      const sdJwtVc = await sdJwtVcService.fromCompact(compact)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: parseDid(issuerDidUrl).did,
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
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
        },
        holder: {
          // FIXME: is it nicer API to just pass either didUrl or JWK?
          // Or none if you don't want to bind it?
          method: 'jwk',
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      const sdJwtVc = await sdJwtVcService.fromCompact(compact)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: parseDid(issuerDidUrl).did,
        value: false,
        discloseableValue: false,
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with a disclosure', async () => {
      const { compact, header, prettyClaims, payload } = await sdJwtVcService.sign(agent.context, {
        payload: { claim: 'some-claim', vct: 'IdentityCredential' },
        disclosureFrame: { _sd: ['claim'] },
        holder: {
          method: 'jwk',
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(compact).toStrictEqual(sdJwtVcWithSingleDisclosure)

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl.split('#')[0],
        _sd: ['vcvFU4DsFKTqQ1vl4nelJWXTb_-0dNoBks6iqNFptyg'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl.split('#')[0],
        claim: 'some-claim',
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
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
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(compact).toStrictEqual(complexSdJwtVc)

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        address: {
          _sd: ['NJnmct0BqBME1JfBlC6jRQVRuevpEONiYw7A7MHuJyQ', 'om5ZztZHB-Gd00LG21CV_xM4FaENSoiaOXnTAJNczB4'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        _sd: [
          '1Cur2k2A2oIB5CshSIf_A_Kg-l26u_qKuWQ79P0Vdas',
          'R1zTUvOYHgcepj0jHypGHz9EHttVKft0yswbc9ETPbU',
          'eDqQpdTXJXbWhf-EsI7zw5X6OvYmFN-UZQQMesXwKPw',
          'pdDk2_XAKHo7gOAfwF1b7OdCUVTit2kJHaxSECQ9xfc',
          'psauKUNWEi09nu3Cl89xKXgmpWENZl5uy1N1nyn_jMk',
          'sN_ge0pHXF6qmsYnX1A9SdwJ8ch8aENkxbODsT74YwI',
        ],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
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
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
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
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
        issuer: {
          method: 'did',
          didUrl: issuerDidUrl,
        },
      })

      expect(header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        _sd: [
          '1Cur2k2A2oIB5CshSIf_A_Kg-l26u_qKuWQ79P0Vdas',
          'R1zTUvOYHgcepj0jHypGHz9EHttVKft0yswbc9ETPbU',
          'eDqQpdTXJXbWhf-EsI7zw5X6OvYmFN-UZQQMesXwKPw',
          'pdDk2_XAKHo7gOAfwF1b7OdCUVTit2kJHaxSECQ9xfc',
          'psauKUNWEi09nu3Cl89xKXgmpWENZl5uy1N1nyn_jMk',
          'sN_ge0pHXF6qmsYnX1A9SdwJ8ch8aENkxbODsT74YwI',
          'yPhxDEM7k7p7eQ9eHHC-Ca6VEA8bzebZpYu7vYmwG6c',
        ],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })

      expect(prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
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
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })
    })
  })

  describe('SdJwtVcService.receive', () => {
    test('Receive sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwtVc = await sdJwtVcService.fromCompact(simpleJwtVc)
      const sdJwtVcRecord = await sdJwtVcService.store(agent.context, sdJwtVc.compact)
      expect(sdJwtVcRecord.compactSdJwtVc).toEqual(simpleJwtVc)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        claim: 'some-claim',
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl.split('#')[0],
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })
    })

    test('Receive sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwtVc = await sdJwtVcService.fromCompact(sdJwtVcWithSingleDisclosure)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl.split('#')[0],
        _sd: ['vcvFU4DsFKTqQ1vl4nelJWXTb_-0dNoBks6iqNFptyg'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })

      expect(sdJwtVc.payload).not.toContain({
        claim: 'some-claim',
      })
    })

    test('Receive sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwtVc = await sdJwtVcService.fromCompact(complexSdJwtVc)

      expect(sdJwtVc.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      expect(sdJwtVc.payload).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        family_name: 'Doe',
        iss: issuerDidUrl.split('#')[0],
        address: {
          _sd: ['NJnmct0BqBME1JfBlC6jRQVRuevpEONiYw7A7MHuJyQ', 'om5ZztZHB-Gd00LG21CV_xM4FaENSoiaOXnTAJNczB4'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        _sd_alg: 'sha-256',
        phone_number: '+1-202-555-0101',
        _sd: [
          '1Cur2k2A2oIB5CshSIf_A_Kg-l26u_qKuWQ79P0Vdas',
          'R1zTUvOYHgcepj0jHypGHz9EHttVKft0yswbc9ETPbU',
          'eDqQpdTXJXbWhf-EsI7zw5X6OvYmFN-UZQQMesXwKPw',
          'pdDk2_XAKHo7gOAfwF1b7OdCUVTit2kJHaxSECQ9xfc',
          'psauKUNWEi09nu3Cl89xKXgmpWENZl5uy1N1nyn_jMk',
          'sN_ge0pHXF6qmsYnX1A9SdwJ8ch8aENkxbODsT74YwI',
        ],
        cnf: {
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })

      expect(sdJwtVc.payload).not.toContain({
        address: {
          region: 'Anystate',
          country: 'US',
        },
        family_name: 'Doe',
        phone_number: '+1-202-555-0101',
        email: 'johndoe@example.com',
        given_name: 'John',
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      })

      expect(sdJwtVc.prettyClaims).toEqual({
        vct: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
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
          jwk: jwkJsonWithoutUse(getJwkFromKey(holderKey)),
        },
      })
    })
  })

  describe('SdJwtVcService.present', () => {
    test('Present sd-jwt-vc from a basic payload without disclosures', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        compactSdJwtVc: simpleJwtVc,
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
      })

      expect(presentation).toStrictEqual(simpleJwtVcPresentation)
    })

    test('Present sd-jwt-vc from a basic payload with a disclosure', async () => {
      const presentation = await sdJwtVcService.present(agent.context, {
        compactSdJwtVc: sdJwtVcWithSingleDisclosure,
        presentationFrame: { claim: true },
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
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
        compactSdJwtVc: complexSdJwtVc,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
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
      const nonce = await agent.context.wallet.generateNonce()
      const presentation = await sdJwtVcService.present(agent.context, {
        compactSdJwtVc: simpleJwtVc,
        // no disclosures
        presentationFrame: {},
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce,
        },
      })

      const { verification } = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce },
        requiredClaimKeys: ['claim'],
      })

      expect(verification).toEqual({
        isSignatureValid: true,
        containsRequiredVcProperties: true,
        containsExpectedKeyBinding: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })

    test('Verify sd-jwt-vc with a disclosure', async () => {
      const nonce = await agent.context.wallet.generateNonce()

      const presentation = await sdJwtVcService.present(agent.context, {
        compactSdJwtVc: sdJwtVcWithSingleDisclosure,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce,
        },
        presentationFrame: { claim: true },
      })

      const { verification } = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce },
        requiredClaimKeys: ['vct', 'cnf', 'claim', 'iat'],
      })

      expect(verification).toEqual({
        isSignatureValid: true,
        containsRequiredVcProperties: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
        containsExpectedKeyBinding: true,
      })
    })

    test('Verify sd-jwt-vc with multiple (nested) disclosure', async () => {
      const nonce = await agent.context.wallet.generateNonce()

      const presentation = await sdJwtVcService.present<{
        is_over_65: boolean
        is_over_21: boolean
        email: boolean
        address: { country: string }
        given_name: boolean
      }>(agent.context, {
        compactSdJwtVc: complexSdJwtVc,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audience: verifierDid,
          nonce,
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

      const { verification } = await sdJwtVcService.verify(agent.context, {
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce },
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

      expect(verification).toEqual({
        isSignatureValid: true,
        areRequiredClaimsIncluded: true,
        containsExpectedKeyBinding: true,
        containsRequiredVcProperties: true,
        isValid: true,
        isKeyBindingValid: true,
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

      expect(verificationResult.verification.isValid).toBe(true)
    })
  })
})
