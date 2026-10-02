import { transformPrivateKeyToPrivateJwk } from '../../../../../../../askar/src'
import { TypedArrayEncoder } from '../../../../../../../core/src/utils'
import type { JsonLdTestsAgent } from '../../../../../../../core/tests'
import { setupJsonLdTests } from '../../../../../../../core/tests'
import { waitForCredentialRecordSubject } from '../../../../../../../core/tests/helpers'
import testLogger from '../../../../../../../core/tests/logger'
import { DidCommCredentialState } from '../../../models'

const credentialOptions = {
  credential: {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  },
  options: {
    proofType: 'Ed25519Signature2018',
    proofPurpose: 'assertionMethod',
  },
}

describe('V2 JSON-LD credential proposal signing preflight', () => {
  let issuerAgent: JsonLdTestsAgent
  let holderAgent: JsonLdTestsAgent
  let issuerReplay: Awaited<ReturnType<typeof setupJsonLdTests>>['issuerReplay']
  let holderReplay: Awaited<ReturnType<typeof setupJsonLdTests>>['holderReplay']
  let holderIssuerConnectionId: string

  beforeAll(async () => {
    const setup = await setupJsonLdTests({
      issuerName: 'JSON-LD proposal preflight issuer',
      holderName: 'JSON-LD proposal preflight holder',
    })
    issuerAgent = setup.issuerAgent
    holderAgent = setup.holderAgent
    issuerReplay = setup.issuerReplay
    holderReplay = setup.holderReplay
    holderIssuerConnectionId = setup.holderIssuerConnectionId

    const key = await issuerAgent.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromUtf8String('testseed000000000000000000000001'),
        type: {
          crv: 'Ed25519',
          kty: 'OKP',
        },
      }).privateJwk,
    })

    await issuerAgent.dids.import({
      did: credentialOptions.credential.issuer,
      keys: [
        {
          didDocumentRelativeKeyId: '#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
          kmsKeyId: key.keyId,
        },
      ],
    })
  })

  afterAll(async () => {
    await issuerAgent.shutdown()
    await holderAgent.shutdown()
  })

  test('rejects an unowned issuer at proposal acceptance, then negotiates and completes issuance', async () => {
    const holderIssuerDidResult = await holderAgent.dids.create({
      method: 'key',
      options: {
        createKey: {
          type: {
            kty: 'OKP',
            crv: 'Ed25519',
          },
        },
      },
    })
    if (holderIssuerDidResult.didState.state !== 'finished') {
      throw new Error('Failed to create holder DID for the incompatible credential proposal')
    }

    const incompatibleCredentialOptions = {
      ...credentialOptions,
      credential: {
        ...credentialOptions.credential,
        issuer: holderIssuerDidResult.didState.did,
      },
    }

    testLogger.test('Holder proposes a JSON-LD credential with an issuer DID not controlled by the issuer agent')
    const holderProposal = await holderAgent.didcomm.credentials.proposeCredential({
      connectionId: holderIssuerConnectionId,
      protocolVersion: 'v2',
      credentialFormats: {
        jsonld: incompatibleCredentialOptions,
      },
    })

    const issuerProposal = await waitForCredentialRecordSubject(issuerReplay, {
      threadId: holderProposal.threadId,
      state: DidCommCredentialState.ProposalReceived,
    })

    await expect(
      issuerAgent.didcomm.credentials.acceptProposal({
        credentialExchangeRecordId: issuerProposal.id,
      })
    ).rejects.toThrow(`Created did '${holderIssuerDidResult.didState.did}' not found`)

    expect((await issuerAgent.didcomm.credentials.getById(issuerProposal.id)).state).toBe(
      DidCommCredentialState.ProposalReceived
    )

    testLogger.test('Issuer sends a compatible counter-offer and completes the exchange')
    const negotiatedOffer = await issuerAgent.didcomm.credentials.negotiateProposal({
      credentialExchangeRecordId: issuerProposal.id,
      credentialFormats: {
        jsonld: credentialOptions,
      },
      comment: 'Compatible JSON-LD counter-offer',
    })
    expect(negotiatedOffer.state).toBe(DidCommCredentialState.OfferSent)

    const holderOffer = await waitForCredentialRecordSubject(holderReplay, {
      threadId: holderProposal.threadId,
      state: DidCommCredentialState.OfferReceived,
    })
    await holderAgent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: holderOffer.id,
      credentialFormats: {
        jsonld: {},
      },
    })

    await waitForCredentialRecordSubject(issuerReplay, {
      threadId: issuerProposal.threadId,
      state: DidCommCredentialState.RequestReceived,
    })
    await issuerAgent.didcomm.credentials.acceptRequest({
      credentialExchangeRecordId: issuerProposal.id,
    })

    const holderCredential = await waitForCredentialRecordSubject(holderReplay, {
      threadId: holderProposal.threadId,
      state: DidCommCredentialState.CredentialReceived,
    })
    const credentialMessage = await holderAgent.didcomm.credentials.findCredentialMessage(holderCredential.id)
    expect(credentialMessage?.credentialAttachments[0].getDataAsJson()).toMatchObject({
      issuer: credentialOptions.credential.issuer,
      proof: {
        type: credentialOptions.options.proofType,
      },
    })

    await holderAgent.didcomm.credentials.acceptCredential({
      credentialExchangeRecordId: holderCredential.id,
    })
    const completedIssuerRecord = await waitForCredentialRecordSubject(issuerReplay, {
      threadId: issuerProposal.threadId,
      state: DidCommCredentialState.Done,
    })
    expect(completedIssuerRecord.state).toBe(DidCommCredentialState.Done)
  })
})
