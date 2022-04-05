import type { AgentConfig } from '../../../agent/AgentConfig'

import { purposes } from '@digitalcredentials/jsonld-signatures'
import { validateSync } from 'class-validator'

import { getAgentConfig } from '../../../../tests/helpers'
import { TestLogger } from '../../../../tests/logger'
import { Key, KeyType } from '../../../crypto'
import { LogLevel } from '../../../logger'
import { JsonTransformer } from '../../../utils'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { WalletError } from '../../../wallet/error'
import { DidKey, DidResolverService } from '../../dids'
import { DidRepository } from '../../dids/repository'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredential, W3cVerifiableCredential } from '../models'
import { LinkedDataProof } from '../models/LinkedDataProof'
import { W3cCredentialRepository } from '../models/credential/W3cCredentialRepository'
import { W3cPresentation } from '../models/presentation/W3Presentation'
import { W3cVerifiablePresentation } from '../models/presentation/W3cVerifiablePresentation'
import { CredentialIssuancePurpose } from '../proof-purposes/CredentialIssuancePurpose'

import { BbsBlsSignature2020Fixtures, Ed25519Signature2018Fixtures } from './fixtures'

jest.mock('../../ledger/services/IndyLedgerService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const DidRepositoryMock = DidRepository as unknown as jest.Mock<DidRepository>

jest.mock('../models/credential/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>

const printJson = (json: any) => {
  console.log(JSON.stringify(JsonTransformer.toJSON(json), null, 2))
}

describe('W3cCredentialService', () => {
  let wallet: IndyWallet
  let agentConfig: AgentConfig
  let didResolverService: DidResolverService
  let logger: TestLogger
  let w3cCredentialService: W3cCredentialService
  let w3cCredentialRepository: W3cCredentialRepository
  let issuerDidKey: DidKey

  beforeAll(async () => {
    agentConfig = getAgentConfig('W3cCredentialServiceTest')
    wallet = new IndyWallet(agentConfig)
    logger = new TestLogger(LogLevel.error)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
    await wallet.initPublicDid({})
    didResolverService = new DidResolverService(agentConfig, new IndyLedgerServiceMock(), new DidRepositoryMock())
    w3cCredentialRepository = new W3cCredentialRepositoryMock()
    w3cCredentialService = new W3cCredentialService(
      wallet,
      w3cCredentialRepository,
      didResolverService,
      agentConfig,
      logger
    )
  })

  afterAll(async () => {
    await wallet.delete()
  })

  describe('Ed25519Signature2018', () => {
    beforeAll(() => {
      const pubDid = wallet.publicDid
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const key = Key.fromPublicKeyBase58(pubDid!.verkey, KeyType.Ed25519)
      issuerDidKey = new DidKey(key)
    })
    describe('signCredential', () => {
      it('should return a successfully signed credential', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        const vc = await w3cCredentialService.signCredential({
          credential,
          proofType: 'Ed25519Signature2018',
          verificationMethod: issuerDidKey.keyId,
        })

        expect(vc).toBeInstanceOf(W3cVerifiableCredential)
        expect(vc.issuer).toEqual(issuerDidKey.did)
        expect(Array.isArray(vc.proof)).toBe(false)
        expect(vc.proof).toBeInstanceOf(LinkedDataProof)

        // @ts-ignore
        expect(vc.proof.verificationMethod).toEqual(issuerDidKey.keyId)
      })

      it('should throw because of did:key does not belong to this wallet', async () => {
        const credentialJson = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT
        credentialJson.issuer = issuerDidKey.did

        const credential = JsonTransformer.fromJSON(credentialJson, W3cCredential)

        expect(async () => {
          await w3cCredentialService.signCredential({
            credential,
            proofType: 'Ed25519Signature2018',
            verificationMethod:
              'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH#z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
          })
        }).rejects.toThrowError(WalletError)
      })
    })
    describe('verifyCredential', () => {
      it('credential should verify successfully', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(true)
        expect(result.error).toBeUndefined()

        expect(result.results.length).toBe(1)

        expect(result.results[0].verified).toBe(true)
        expect(result.results[0].error).toBeUndefined()
      })
      it('credential fail to verify because of invalid signature', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_INVALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.verifyCredential({ credential: vc })

        expect(result.verified).toBe(false)
        expect(result.error).toBeDefined()

        // @ts-ignore
        expect(result.error.errors[0]).toBeInstanceOf(Error)
        // @ts-ignore
        expect(result.error.errors[0].message).toBe('Invalid signature.')
      })
    })
    describe('createPresentation', () => {
      it('should successfully create a presentation from single verifiable credential', async () => {
        const vc = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )
        const result = await w3cCredentialService.createPresentation({ credentials: vc })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(1)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc]))
      })
      it('should successfully create a presentation from two verifiable credential', async () => {
        const vc1 = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )
        const vc2 = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )

        const vcs = [vc1, vc2]
        const result = await w3cCredentialService.createPresentation({ credentials: vcs })

        expect(result).toBeInstanceOf(W3cPresentation)

        expect(result.type).toEqual(expect.arrayContaining(['VerifiablePresentation']))

        expect(result.verifiableCredential).toHaveLength(2)
        expect(result.verifiableCredential).toEqual(expect.arrayContaining([vc1, vc2]))
      })
    })
    describe('signPresentation', () => {
      it('should successfully create a presentation from single verifiable credential', async () => {
        const presentation = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_PRESENTATION,
          W3cPresentation
        )

        const purpose = new CredentialIssuancePurpose({
          controller: {},
          date: new Date().toISOString(),
        })

        const verifiablePresentation = await w3cCredentialService.signPresentation({
          presentation: presentation,
          purpose: purpose,
          signatureType: 'Ed25519Signature2018',
          verificationMethod: issuerDidKey.keyId,
        })

        expect(verifiablePresentation).toBeInstanceOf(W3cVerifiablePresentation)
      })
    })
    describe('verifyPresentation', () => {
      it('should successfully verify a presentation containing a single verifiable credential', async () => {
        const vp = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_PRESENTATION,
          W3cVerifiablePresentation
        )

        const purpose = new CredentialIssuancePurpose({
          controller: {},
          date: new Date().toISOString(),
        })

        const result = await w3cCredentialService.verifyPresentation({
          presentation: vp,
          proofType: 'Ed25519Signature2018',
          purpose: purpose,
          verificationMethod: issuerDidKey.keyId,
        })
      })
    })
    describe('storeCredential', () => {
      it('should store a credential', async () => {
        const credential = JsonTransformer.fromJSON(
          Ed25519Signature2018Fixtures.TEST_VALID_VERIFIABLE_CREDENTIAL,
          W3cVerifiableCredential
        )

        const w3cCredentialRecord = await w3cCredentialService.storeCredential({ record: credential })

        expect(w3cCredentialRecord).toMatchObject({
          type: 'W3cCredentialRecord',
          id: expect.any(String),
          createdAt: expect.any(Date),
          credential: expect.any(W3cVerifiableCredential),
        })

        expect(w3cCredentialRecord.getTags()).toMatchObject({
          expandedTypes: [
            'https://www.w3.org/2018/credentials#VerifiableCredential',
            'https://example.org/examples#UniversityDegreeCredential',
          ],
        })
      })
    })
  })

  xdescribe('BbsBlsSignature2020', () => {
    beforeAll(async () => {
      const key = await wallet.createKey({ keyType: KeyType.Bls12381g2 })
      issuerDidKey = new DidKey(key)
    })
    describe('signCredential', () => {
      it('should return a successfully signed credential', async () => {
        const inputDoc = {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/citizenship/v1',
            'https://w3id.org/security/bbs/v1',
          ],
          id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
          type: ['VerifiableCredential', 'PermanentResidentCard'],
          issuer: issuerDidKey.did,
          identifier: '83627465',
          name: 'Permanent Resident Card',
          description: 'Government of Example Permanent Resident Card.',
          issuanceDate: '2019-12-03T12:19:52Z',
          expirationDate: '2029-12-03T12:19:52Z',
          credentialSubject: {
            id: 'did:example:b34ca6cd37bbf23',
            type: ['PermanentResident', 'Person'],
            givenName: 'JOHN',
            familyName: 'SMITH',
            gender: 'Male',
            image: 'data:image/png;base64,iVBORw0KGgokJggg==',
            residentSince: '2015-01-01',
            lprCategory: 'C09',
            lprNumber: '999-999-999',
            commuterClassification: 'C1',
            birthCountry: 'Bahamas',
            birthDate: '1958-07-17',
          },
        }

        const credential = JsonTransformer.fromJSON(inputDoc, W3cCredential)

        const vc = await w3cCredentialService.signCredential({
          credential,
          proofType: 'BbsBlsSignature2020',
          verificationMethod: issuerDidKey.keyId,
        })
        printJson(vc)
      })
    })
    xdescribe('verifyCredential', () => {
      it('should verify the credential successfully', async () => {
        const result = await w3cCredentialService.verifyCredential({
          credential: JsonTransformer.fromJSON(BbsBlsSignature2020Fixtures.signedCredential, W3cVerifiableCredential),
          proofPurpose: new purposes.AssertionProofPurpose(),
        })
        console.log(result)
      })
    })
    xdescribe('deriveProof', () => {
      it('', async () => {
        const inputDoc = {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/citizenship/v1',
            'https://w3id.org/security/bbs/v1',
          ],
          id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
          type: ['VerifiableCredential', 'PermanentResidentCard'],
          issuer: issuerDidKey.did,
          identifier: '83627465',
          name: 'Permanent Resident Card',
          description: 'Government of Example Permanent Resident Card.',
          issuanceDate: '2019-12-03T12:19:52Z',
          expirationDate: '2029-12-03T12:19:52Z',
          credentialSubject: {
            id: 'did:example:b34ca6cd37bbf23',
            type: ['PermanentResident', 'Person'],
            givenName: 'JOHN',
            familyName: 'SMITH',
            gender: 'Male',
            image: 'data:image/png;base64,iVBORw0KGgokJggg==',
            residentSince: '2015-01-01',
            lprCategory: 'C09',
            lprNumber: '999-999-999',
            commuterClassification: 'C1',
            birthCountry: 'Bahamas',
            birthDate: '1958-07-17',
          },
        }

        const credential = JsonTransformer.fromJSON(inputDoc, W3cCredential)

        const vc = await w3cCredentialService.signCredential({
          credential,
          proofType: 'BbsBlsSignature2020',
          verificationMethod: issuerDidKey.keyId,
        })

        const revealDocument = {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://w3id.org/citizenship/v1',
            'https://w3id.org/security/bbs/v1',
          ],
          type: ['VerifiableCredential', 'PermanentResidentCard'],
          credentialSubject: {
            '@explicit': true,
            type: ['PermanentResident', 'Person'],
            givenName: {},
            familyName: {},
            gender: {},
          },
        }

        const result = await w3cCredentialService.deriveProof({
          credential: vc,
          revealDocument: revealDocument,
          verificationMethod: issuerDidKey.keyId,
        })
      })
    })
    describe('createPresentation', () => {})
    describe('signPresentation', () => {})
    describe('verifyPresentation', () => {})
    describe('storeCredential', () => {})
  })
})
