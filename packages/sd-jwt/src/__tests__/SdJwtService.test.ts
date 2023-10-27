import type { Key, Logger } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import {
  getJwkFromKey,
  DidKey,
  DidsModule,
  KeyDidRegistrar,
  KeyDidResolver,
  utils,
  KeyType,
  Agent,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { agentDependencies } from '../../../core/tests'
import { SdJwtService } from '../SdJwtService'
import { SdJwtRepository } from '../repository'

const agent = new Agent({
  config: { label: 'sdjwtserviceagent', walletConfig: { id: utils.uuid(), key: utils.uuid() } },
  modules: {
    askar: new AskarModule({ ariesAskar }),
    dids: new DidsModule({
      resolvers: [new KeyDidResolver()],
      registrars: [new KeyDidRegistrar()],
    }),
  },
  dependencies: agentDependencies,
})

const logger = jest.fn() as unknown as Logger
agent.context.wallet.generateNonce = jest.fn(() => Promise.resolve('salt'))
Date.prototype.getTime = jest.fn(() => 1698151532000)

jest.mock('../repository/SdJwtRepository')
const SdJwtRepositoryMock = SdJwtRepository as jest.Mock<SdJwtRepository>

describe('SdJwtService', () => {
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'
  let issuerDidUrl: string
  let holderDidUrl: string
  let issuerKey: Key
  let holderKey: Key
  let sdJwtService: SdJwtService

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
    holderDidUrl = (holderDidDocument.verificationMethod ?? [])[0].id
    await agent.dids.import({ didDocument: holderDidDocument, did: holderDidDocument.id })

    const sdJwtRepositoryMock = new SdJwtRepositoryMock()
    sdJwtService = new SdJwtService(sdJwtRepositoryMock, logger)
  })

  describe('SdJwtService.create', () => {
    test('Create sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        {
          claim: 'some-claim',
          type: 'IdentityCredential',
        },
        {
          issuerDidUrl,
          holderDidUrl,
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.E7HBTBPIDVaD8R4-_4srSfRze2qrHTZUthd6Q0_QE2JoQzuw9ACe4TYmJaKxzrO25KtYLrltcDvfNdi1ylCcDQ'
      )

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        claim: 'some-claim',
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl,
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with a disclosure', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        { claim: 'some-claim', type: 'IdentityCredential' },
        {
          issuerDidUrl,
          holderDidUrl,
          disclosureFrame: { claim: true },
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsidmN2RlU0RHNGS1RxUTF2bDRuZWxKV1hUYl8tMGROb0JrczZpcU5GcHR5ZyJdfQ.5Km5xlqypqm2gpHOgv1yF83ruQCPn-473uECHrGjSPBz6fmFwA9YV-qjy0lclVB3ydga8HPiWknB938th18DDg~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'
      )

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl,
        _sd: ['vcvFU4DsFKTqQ1vl4nelJWXTb_-0dNoBks6iqNFptyg'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        claim: 'some-claim',
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(expect.arrayContaining([['salt', 'claim', 'some-claim']]))
    })

    test('Create sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        {
          type: 'IdentityCredential',
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
        {
          issuerDidUrl: issuerDidUrl,
          holderDidUrl: holderDidUrl,
          disclosureFrame: {
            is_over_65: true,
            is_over_21: true,
            is_over_18: true,
            birthdate: true,
            email: true,
            address: { region: true, country: true },
            given_name: true,
          },
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjFDdXIyazJBMm9JQjVDc2hTSWZfQV9LZy1sMjZ1X3FLdVdRNzlQMFZkYXMiLCJSMXpUVXZPWUhnY2VwajBqSHlwR0h6OUVIdHRWS2Z0MHlzd2JjOUVUUGJVIiwiZURxUXBkVFhKWGJXaGYtRXNJN3p3NVg2T3ZZbUZOLVVaUVFNZXNYd0tQdyIsInBkRGsyX1hBS0hvN2dPQWZ3RjFiN09kQ1VWVGl0MmtKSGF4U0VDUTl4ZmMiLCJwc2F1S1VOV0VpMDludTNDbDg5eEtYZ21wV0VOWmw1dXkxTjFueW5fak1rIiwic05fZ2UwcEhYRjZxbXNZblgxQTlTZHdKOGNoOGFFTmt4Yk9Ec1Q3NFl3SSJdfQ.NC9g6Qrx64x_BNFRkKoMokDECUNvOfawKNiwWA9Gn9wDEZ6kz5A3kQtnRkfrpNZvx0yE6XN76R7A7r2AM-uWDQ~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'
      )

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        address: {
          _sd: ['NJnmct0BqBME1JfBlC6jRQVRuevpEONiYw7A7MHuJyQ', 'om5ZztZHB-Gd00LG21CV_xM4FaENSoiaOXnTAJNczB4'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
        family_name: 'Doe',
        iss: issuerDidUrl,
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
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        family_name: 'Doe',
        phone_number: '+1-202-555-0101',
        address: {
          region: 'Anystate',
          country: 'US',
        },
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(
        expect.arrayContaining([
          ['salt', 'is_over_65', true],
          ['salt', 'is_over_21', true],
          ['salt', 'is_over_18', true],
          ['salt', 'birthdate', '1940-01-01'],
          ['salt', 'email', 'johndoe@example.com'],
          ['salt', 'region', 'Anystate'],
          ['salt', 'country', 'US'],
          ['salt', 'given_name', 'John'],
        ])
      )
    })
  })

  describe('SdJwtService.receive', () => {
    test('Receive sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.E7HBTBPIDVaD8R4-_4srSfRze2qrHTZUthd6Q0_QE2JoQzuw9ACe4TYmJaKxzrO25KtYLrltcDvfNdi1ylCcDQ'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, {
        issuerDidUrl,
        holderDidUrl,
      })

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        claim: 'some-claim',
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl,
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })
    })

    test('Receive sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsidmN2RlU0RHNGS1RxUTF2bDRuZWxKV1hUYl8tMGROb0JrczZpcU5GcHR5ZyJdfQ.5Km5xlqypqm2gpHOgv1yF83ruQCPn-473uECHrGjSPBz6fmFwA9YV-qjy0lclVB3ydga8HPiWknB938th18DDg~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, {
        issuerDidUrl,
        holderDidUrl,
      })

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        iss: issuerDidUrl,
        _sd: ['vcvFU4DsFKTqQ1vl4nelJWXTb_-0dNoBks6iqNFptyg'],
        _sd_alg: 'sha-256',
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        claim: 'some-claim',
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(expect.arrayContaining([['salt', 'claim', 'some-claim']]))
    })

    test('Receive sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjFDdXIyazJBMm9JQjVDc2hTSWZfQV9LZy1sMjZ1X3FLdVdRNzlQMFZkYXMiLCJSMXpUVXZPWUhnY2VwajBqSHlwR0h6OUVIdHRWS2Z0MHlzd2JjOUVUUGJVIiwiZURxUXBkVFhKWGJXaGYtRXNJN3p3NVg2T3ZZbUZOLVVaUVFNZXNYd0tQdyIsInBkRGsyX1hBS0hvN2dPQWZ3RjFiN09kQ1VWVGl0MmtKSGF4U0VDUTl4ZmMiLCJwc2F1S1VOV0VpMDludTNDbDg5eEtYZ21wV0VOWmw1dXkxTjFueW5fak1rIiwic05fZ2UwcEhYRjZxbXNZblgxQTlTZHdKOGNoOGFFTmt4Yk9Ec1Q3NFl3SSJdfQ.NC9g6Qrx64x_BNFRkKoMokDECUNvOfawKNiwWA9Gn9wDEZ6kz5A3kQtnRkfrpNZvx0yE6XN76R7A7r2AM-uWDQ~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      expect(sdJwtRecord.sdJwt.header).toEqual({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toEqual({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        family_name: 'Doe',
        iss: issuerDidUrl,
        address: {
          _sd: ['NJnmct0BqBME1JfBlC6jRQVRuevpEONiYw7A7MHuJyQ', 'om5ZztZHB-Gd00LG21CV_xM4FaENSoiaOXnTAJNczB4'],
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
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
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        family_name: 'Doe',
        phone_number: '+1-202-555-0101',
        address: {
          region: 'Anystate',
          country: 'US',
        },
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(
        expect.arrayContaining([
          ['salt', 'is_over_65', true],
          ['salt', 'is_over_21', true],
          ['salt', 'is_over_18', true],
          ['salt', 'birthdate', '1940-01-01'],
          ['salt', 'email', 'johndoe@example.com'],
          ['salt', 'region', 'Anystate'],
          ['salt', 'country', 'US'],
          ['salt', 'given_name', 'John'],
        ])
      )
    })
  })

  describe('SdJwtService.present', () => {
    test('Present sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.E7HBTBPIDVaD8R4-_4srSfRze2qrHTZUthd6Q0_QE2JoQzuw9ACe4TYmJaKxzrO25KtYLrltcDvfNdi1ylCcDQ'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerDidUrl, holderDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
      })

      expect(presentation).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.E7HBTBPIDVaD8R4-_4srSfRze2qrHTZUthd6Q0_QE2JoQzuw9ACe4TYmJaKxzrO25KtYLrltcDvfNdi1ylCcDQ~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkifQ.VdZSnQJ5sklqMPnIzaOaGxP2qPiEPniTaUFHy4VMcW9h9pV1c17fcuTySJtmV2tcpKhei4ss04q_rFyN1EVRDg'
      )
    })

    test('Present sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsidmN2RlU0RHNGS1RxUTF2bDRuZWxKV1hUYl8tMGROb0JrczZpcU5GcHR5ZyJdfQ.5Km5xlqypqm2gpHOgv1yF83ruQCPn-473uECHrGjSPBz6fmFwA9YV-qjy0lclVB3ydga8HPiWknB938th18DDg~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0],
      })

      expect(presentation).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsidmN2RlU0RHNGS1RxUTF2bDRuZWxKV1hUYl8tMGROb0JrczZpcU5GcHR5ZyJdfQ.5Km5xlqypqm2gpHOgv1yF83ruQCPn-473uECHrGjSPBz6fmFwA9YV-qjy0lclVB3ydga8HPiWknB938th18DDg~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkifQ.VdZSnQJ5sklqMPnIzaOaGxP2qPiEPniTaUFHy4VMcW9h9pV1c17fcuTySJtmV2tcpKhei4ss04q_rFyN1EVRDg'
      )
    })

    test('Present sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjFDdXIyazJBMm9JQjVDc2hTSWZfQV9LZy1sMjZ1X3FLdVdRNzlQMFZkYXMiLCJSMXpUVXZPWUhnY2VwajBqSHlwR0h6OUVIdHRWS2Z0MHlzd2JjOUVUUGJVIiwiZURxUXBkVFhKWGJXaGYtRXNJN3p3NVg2T3ZZbUZOLVVaUVFNZXNYd0tQdyIsInBkRGsyX1hBS0hvN2dPQWZ3RjFiN09kQ1VWVGl0MmtKSGF4U0VDUTl4ZmMiLCJwc2F1S1VOV0VpMDludTNDbDg5eEtYZ21wV0VOWmw1dXkxTjFueW5fak1rIiwic05fZ2UwcEhYRjZxbXNZblgxQTlTZHdKOGNoOGFFTmt4Yk9Ec1Q3NFl3SSJdfQ.NC9g6Qrx64x_BNFRkKoMokDECUNvOfawKNiwWA9Gn9wDEZ6kz5A3kQtnRkfrpNZvx0yE6XN76R7A7r2AM-uWDQ~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0, 1, 4, 6, 7],
      })

      expect(presentation).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjFDdXIyazJBMm9JQjVDc2hTSWZfQV9LZy1sMjZ1X3FLdVdRNzlQMFZkYXMiLCJSMXpUVXZPWUhnY2VwajBqSHlwR0h6OUVIdHRWS2Z0MHlzd2JjOUVUUGJVIiwiZURxUXBkVFhKWGJXaGYtRXNJN3p3NVg2T3ZZbUZOLVVaUVFNZXNYd0tQdyIsInBkRGsyX1hBS0hvN2dPQWZ3RjFiN09kQ1VWVGl0MmtKSGF4U0VDUTl4ZmMiLCJwc2F1S1VOV0VpMDludTNDbDg5eEtYZ21wV0VOWmw1dXkxTjFueW5fak1rIiwic05fZ2UwcEhYRjZxbXNZblgxQTlTZHdKOGNoOGFFTmt4Yk9Ec1Q3NFl3SSJdfQ.NC9g6Qrx64x_BNFRkKoMokDECUNvOfawKNiwWA9Gn9wDEZ6kz5A3kQtnRkfrpNZvx0yE6XN76R7A7r2AM-uWDQ~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6elVDNzRWRXFxaEVIUWNndjR6YWdTUGtxRkp4dU5XdW9CUEtqSnVIRVRFVWVITG9TcVd0OTJ2aVNzbWFXank4MnkifQ.VdZSnQJ5sklqMPnIzaOaGxP2qPiEPniTaUFHy4VMcW9h9pV1c17fcuTySJtmV2tcpKhei4ss04q_rFyN1EVRDg'
      )
    })
  })

  describe('SdJwtService.verify', () => {
    test('Verify sd-jwt-vc without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMn0.E7HBTBPIDVaD8R4-_4srSfRze2qrHTZUthd6Q0_QE2JoQzuw9ACe4TYmJaKxzrO25KtYLrltcDvfNdi1ylCcDQ'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid,
        issuerDidUrl,
        holderDidUrl,
        requiredClaimKeys: ['claim'],
      })

      expect(validation).toEqual({
        isSignatureValid: true,
        containsRequiredVcProperties: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })

    test('Verify sd-jwt-vc with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XI3o2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsidmN2RlU0RHNGS1RxUTF2bDRuZWxKV1hUYl8tMGROb0JrczZpcU5GcHR5ZyJdfQ.5Km5xlqypqm2gpHOgv1yF83ruQCPn-473uECHrGjSPBz6fmFwA9YV-qjy0lclVB3ydga8HPiWknB938th18DDg~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0],
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid,
        holderDidUrl,
        issuerDidUrl,
        requiredClaimKeys: ['type', 'cnf', 'claim', 'iat'],
      })

      expect(validation).toEqual({
        isSignatureValid: true,
        containsRequiredVcProperties: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })

    test('Verify sd-jwt-vc with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJvRU5Wc3hPVWlINTRYOHdKTGFWa2ljQ1JrMDB3QklRNHNSZ2JrNTROOE1vIn19LCJpc3MiOiJkaWQ6a2V5Ono2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyN6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJpYXQiOjE2OTgxNTE1MzIsIl9zZF9hbGciOiJzaGEtMjU2IiwiX3NkIjpbIjFDdXIyazJBMm9JQjVDc2hTSWZfQV9LZy1sMjZ1X3FLdVdRNzlQMFZkYXMiLCJSMXpUVXZPWUhnY2VwajBqSHlwR0h6OUVIdHRWS2Z0MHlzd2JjOUVUUGJVIiwiZURxUXBkVFhKWGJXaGYtRXNJN3p3NVg2T3ZZbUZOLVVaUVFNZXNYd0tQdyIsInBkRGsyX1hBS0hvN2dPQWZ3RjFiN09kQ1VWVGl0MmtKSGF4U0VDUTl4ZmMiLCJwc2F1S1VOV0VpMDludTNDbDg5eEtYZ21wV0VOWmw1dXkxTjFueW5fak1rIiwic05fZ2UwcEhYRjZxbXNZblgxQTlTZHdKOGNoOGFFTmt4Yk9Ec1Q3NFl3SSJdfQ.NC9g6Qrx64x_BNFRkKoMokDECUNvOfawKNiwWA9Gn9wDEZ6kz5A3kQtnRkfrpNZvx0yE6XN76R7A7r2AM-uWDQ~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderDidUrl, issuerDidUrl })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderDidUrl,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          verifierDid,
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0, 1, 4, 6, 7],
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid,
        issuerDidUrl,
        holderDidUrl,
        requiredClaimKeys: [
          'type',
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
          'street_address',
          'locality',
          'country',
        ],
      })

      expect(validation).toEqual({
        isSignatureValid: true,
        areRequiredClaimsIncluded: true,
        containsRequiredVcProperties: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })
  })
})
