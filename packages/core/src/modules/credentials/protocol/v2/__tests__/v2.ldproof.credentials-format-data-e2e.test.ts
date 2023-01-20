import type { Awaited } from '../../../../../types'
import type { Wallet } from '../../../../../wallet'
import type { ConnectionRecord } from '../../../../connections'
import type { JsonCredential, JsonLdCredentialDetailFormat } from '../../../formats/jsonld/JsonLdCredentialFormat'

import { setupCredentialTests, waitForCredentialRecord } from '../../../../../../tests/helpers'
import testLogger from '../../../../../../tests/logger'
import { InjectionSymbols } from '../../../../../constants'
import { KeyType } from '../../../../../crypto'
import { DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { CredentialState } from '../../../models'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

describe('credentials', () => {
  let faberAgent: Awaited<ReturnType<typeof setupCredentialTests>>['faberAgent']
  let aliceAgent: Awaited<ReturnType<typeof setupCredentialTests>>['aliceAgent']
  let aliceConnection: ConnectionRecord
  let aliceCredentialRecord: CredentialExchangeRecord
  let faberCredentialRecord: CredentialExchangeRecord

  let didCommMessageRepository: DidCommMessageRepository

  const inputDocAsJson: JsonCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/citizenship/v1',
      'https://w3id.org/security/bbs/v1',
    ],
    id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
    type: ['VerifiableCredential', 'PermanentResidentCard'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2019-12-03T12:19:52Z',
    expirationDate: '2029-12-03T12:19:52Z',
    identifier: '83627465',
    name: 'Permanent Resident Card',
    credentialSubject: {
      id: 'did:example:b34ca6cd37bbf23',
      type: ['PermanentResident', 'Person'],
      givenName: 'JOHN',
      familyName: 'SMITH',
      gender: 'Male',
      image: 'data:image/png;base64,iVBORw0KGgokJggg==',
      residentSince: '2015-01-01',
      description: 'Government of Example Permanent Resident Card.',
      lprCategory: 'C09',
      lprNumber: '999-999-999',
      commuterClassification: 'C1',
      birthCountry: 'Bahamas',
      birthDate: '1958-07-17',
    },
  }

  let signCredentialOptions: JsonLdCredentialDetailFormat

  let wallet
  const seed = 'testseed000000000000000000000001'

  beforeAll(async () => {
    ;({ faberAgent, aliceAgent, aliceConnection } = await setupCredentialTests(
      'Faber Agent Credentials LD',
      'Alice Agent Credentials LD'
    ))
    wallet = faberAgent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)
    await wallet.createKey({ seed, keyType: KeyType.Ed25519 })
    signCredentialOptions = {
      credential: inputDocAsJson,
      options: {
        proofType: 'Ed25519Signature2018',
        proofPurpose: 'assertionMethod',
      },
    }
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice starts with V2 (ld format, Ed25519 signature) credential proposal to Faber', async () => {
    testLogger.test('Alice sends (v2 jsonld) credential proposal to Faber')

    const credentialExchangeRecord: CredentialExchangeRecord = await aliceAgent.credentials.proposeCredential({
      connectionId: aliceConnection.id,
      protocolVersion: 'v2',
      credentialFormats: {
        jsonld: signCredentialOptions,
      },
      comment: 'v2 propose credential test for W3C Credentials',
    })

    expect(credentialExchangeRecord.connectionId).toEqual(aliceConnection.id)
    expect(credentialExchangeRecord.protocolVersion).toEqual('v2')
    expect(credentialExchangeRecord.state).toEqual(CredentialState.ProposalSent)
    expect(credentialExchangeRecord.threadId).not.toBeNull()

    testLogger.test('Faber waits for credential proposal from Alice')
    faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
      threadId: credentialExchangeRecord.threadId,
      state: CredentialState.ProposalReceived,
    })

    testLogger.test('Faber sends credential offer to Alice')
    await faberAgent.credentials.acceptProposal({
      credentialRecordId: faberCredentialRecord.id,
      comment: 'V2 W3C Offer',
    })

    testLogger.test('Alice waits for credential offer from Faber')
    aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
      threadId: faberCredentialRecord.threadId,
      state: CredentialState.OfferReceived,
    })

    didCommMessageRepository = faberAgent.dependencyManager.resolve(DidCommMessageRepository)

    const offerMessage = await didCommMessageRepository.findAgentMessage(aliceAgent.context, {
      associatedRecordId: aliceCredentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    expect(JsonTransformer.toJSON(offerMessage)).toMatchObject({
      '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
      '@id': expect.any(String),
      comment: 'V2 W3C Offer',
      formats: [
        {
          attach_id: expect.any(String),
          format: 'aries/ld-proof-vc-detail@v1.0',
        },
      ],
      'offers~attach': [
        {
          '@id': expect.any(String),
          'mime-type': 'application/json',
          data: expect.any(Object),
          lastmod_time: undefined,
          byte_count: undefined,
        },
      ],
      '~thread': {
        thid: expect.any(String),
        pthid: undefined,
        sender_order: undefined,
        received_orders: undefined,
      },
      '~service': undefined,
      '~attach': undefined,
      '~please_ack': undefined,
      '~timing': undefined,
      '~transport': undefined,
      '~l10n': undefined,
      credential_preview: expect.any(Object),
      replacement_id: undefined,
    })
    expect(aliceCredentialRecord.id).not.toBeNull()
    expect(aliceCredentialRecord.type).toBe(CredentialExchangeRecord.type)

    if (aliceCredentialRecord.connectionId) {
      const offerCredentialExchangeRecord = await aliceAgent.credentials.acceptOffer({
        credentialRecordId: aliceCredentialRecord.id,
        credentialFormats: {
          jsonld: {},
        },
      })

      expect(offerCredentialExchangeRecord.connectionId).toEqual(aliceConnection.id)
      expect(offerCredentialExchangeRecord.protocolVersion).toEqual('v2')
      expect(offerCredentialExchangeRecord.state).toEqual(CredentialState.RequestSent)
      expect(offerCredentialExchangeRecord.threadId).not.toBeNull()

      testLogger.test('Faber waits for credential request from Alice')
      await waitForCredentialRecord(faberAgent, {
        threadId: aliceCredentialRecord.threadId,
        state: CredentialState.RequestReceived,
      })

      testLogger.test('Faber sends credential to Alice')

      await faberAgent.credentials.acceptRequest({
        credentialRecordId: faberCredentialRecord.id,
        comment: 'V2 Indy Credential',
      })

      testLogger.test('Alice waits for credential from Faber')
      aliceCredentialRecord = await waitForCredentialRecord(aliceAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.CredentialReceived,
      })

      testLogger.test('Alice sends credential ack to Faber')
      await aliceAgent.credentials.acceptCredential({ credentialRecordId: aliceCredentialRecord.id })

      testLogger.test('Faber waits for credential ack from Alice')
      faberCredentialRecord = await waitForCredentialRecord(faberAgent, {
        threadId: faberCredentialRecord.threadId,
        state: CredentialState.Done,
      })

      const formatData = await aliceAgent.credentials.getFormatData(aliceCredentialRecord.id)

      expect(formatData).toMatchObject({
        offerAttributes: [],
        proposal: {
          jsonld: {
            credential: {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/citizenship/v1',
                'https://w3id.org/security/bbs/v1',
              ],
              id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
              type: ['VerifiableCredential', 'PermanentResidentCard'],
              issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              issuanceDate: '2019-12-03T12:19:52Z',
              expirationDate: '2029-12-03T12:19:52Z',
              identifier: '83627465',
              name: 'Permanent Resident Card',
              credentialSubject: {
                id: 'did:example:b34ca6cd37bbf23',
                type: ['PermanentResident', 'Person'],
                givenName: 'JOHN',
                familyName: 'SMITH',
                gender: 'Male',
                image: 'data:image/png;base64,iVBORw0KGgokJggg==',
                residentSince: '2015-01-01',
                description: 'Government of Example Permanent Resident Card.',
                lprCategory: 'C09',
                lprNumber: '999-999-999',
                commuterClassification: 'C1',
                birthCountry: 'Bahamas',
                birthDate: '1958-07-17',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },

        offer: {
          jsonld: {
            credential: {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/citizenship/v1',
                'https://w3id.org/security/bbs/v1',
              ],
              id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
              type: ['VerifiableCredential', 'PermanentResidentCard'],
              issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              issuanceDate: '2019-12-03T12:19:52Z',
              expirationDate: '2029-12-03T12:19:52Z',
              identifier: '83627465',
              name: 'Permanent Resident Card',
              credentialSubject: {
                id: 'did:example:b34ca6cd37bbf23',
                type: ['PermanentResident', 'Person'],
                givenName: 'JOHN',
                familyName: 'SMITH',
                gender: 'Male',
                image: 'data:image/png;base64,iVBORw0KGgokJggg==',
                residentSince: '2015-01-01',
                description: 'Government of Example Permanent Resident Card.',
                lprCategory: 'C09',
                lprNumber: '999-999-999',
                commuterClassification: 'C1',
                birthCountry: 'Bahamas',
                birthDate: '1958-07-17',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
        request: {
          jsonld: {
            credential: {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://w3id.org/citizenship/v1',
                'https://w3id.org/security/bbs/v1',
              ],
              id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
              type: ['VerifiableCredential', 'PermanentResidentCard'],
              issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              issuanceDate: '2019-12-03T12:19:52Z',
              expirationDate: '2029-12-03T12:19:52Z',
              identifier: '83627465',
              name: 'Permanent Resident Card',
              credentialSubject: {
                id: 'did:example:b34ca6cd37bbf23',
                type: ['PermanentResident', 'Person'],
                givenName: 'JOHN',
                familyName: 'SMITH',
                gender: 'Male',
                image: 'data:image/png;base64,iVBORw0KGgokJggg==',
                residentSince: '2015-01-01',
                description: 'Government of Example Permanent Resident Card.',
                lprCategory: 'C09',
                lprNumber: '999-999-999',
                commuterClassification: 'C1',
                birthCountry: 'Bahamas',
                birthDate: '1958-07-17',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
        credential: {
          jsonld: {
            context: [
              'https://www.w3.org/2018/credentials/v1',
              'https://w3id.org/citizenship/v1',
              'https://w3id.org/security/bbs/v1',
            ],
            id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
            type: ['VerifiableCredential', 'PermanentResidentCard'],
            issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
            issuanceDate: '2019-12-03T12:19:52Z',
            expirationDate: '2029-12-03T12:19:52Z',
            identifier: '83627465',
            name: 'Permanent Resident Card',
            credentialSubject: {
              id: 'did:example:b34ca6cd37bbf23',
              type: ['PermanentResident', 'Person'],
              givenName: 'JOHN',
              familyName: 'SMITH',
              gender: 'Male',
              image: 'data:image/png;base64,iVBORw0KGgokJggg==',
              residentSince: '2015-01-01',
              description: 'Government of Example Permanent Resident Card.',
              lprCategory: 'C09',
              lprNumber: '999-999-999',
              commuterClassification: 'C1',
              birthCountry: 'Bahamas',
              birthDate: '1958-07-17',
            },
            proof: {
              verificationMethod:
                'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
              type: 'Ed25519Signature2018',
              created: expect.any(String),
              proofPurpose: 'assertionMethod',
              jws: expect.any(String),
            },
          },
        },
      })
    }
  })
})
