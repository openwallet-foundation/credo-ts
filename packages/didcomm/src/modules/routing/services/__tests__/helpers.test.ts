import {
  DidDocument,
  getEd25519VerificationKey2018,
  getX25519KeyAgreementKey2019,
  Kms,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  TypedArrayEncoder,
} from '@credo-ts/core'

import type { MockedClassConstructor } from '../../../../../../../tests/types'
import { getAgentContext, mockFunction } from '../../../../../../core/tests/helpers'
import type { DidCommMediationRecord } from '../../repository'
import { DidCommMediationRecipientService } from '../DidCommMediationRecipientService'
import { getMediationRecordForDidDocument } from '../helpers'

vi.mock('../DidCommMediationRecipientService')
const MediationRecipientServiceMock = DidCommMediationRecipientService as MockedClassConstructor<
  typeof DidCommMediationRecipientService
>

const mediationRecipientService = new MediationRecipientServiceMock()
const agentContext = getAgentContext({
  registerInstances: [[DidCommMediationRecipientService, mediationRecipientService]],
})

const mediationRecord = { id: 'mediation-record-id' } as DidCommMediationRecord

const ed25519PublicJwk = Kms.PublicJwk.fromFingerprint(
  'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'
) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
const x25519PublicJwk = Kms.PublicJwk.fromFingerprint(
  'z6LSbkodSr6SU2trs8VUgnrnWtSm7BAPG245ggrBmSrxbv1R'
) as Kms.PublicJwk<Kms.X25519PublicJwk>
const x25519Base58 = TypedArrayEncoder.toBase58(x25519PublicJwk.publicKey.publicKey)

const did = 'did:example:ours'
const ed25519VerificationMethod = getEd25519VerificationKey2018({
  publicJwk: ed25519PublicJwk,
  controller: did,
  id: `${did}#key-1`,
})
const x25519VerificationMethod = getX25519KeyAgreementKey2019({
  publicJwk: x25519PublicJwk,
  controller: did,
  id: `${did}#key-agreement-1`,
})

// A DIDComm v2 only document: no did-communication service, so `recipientKeys` is empty
const v2OnlyDidDocument = new DidDocument({
  id: did,
  verificationMethod: [ed25519VerificationMethod, x25519VerificationMethod],
  authentication: [ed25519VerificationMethod.id],
  keyAgreement: [x25519VerificationMethod.id],
  service: [
    new NewDidCommV2Service({
      id: `${did}#dm`,
      serviceEndpoint: new NewDidCommV2ServiceEndpoint({ uri: 'https://mediator.example', accept: ['didcomm/v2'] }),
    }),
  ],
})

// A document without DIDComm services has no recipient keys at all
const didDocumentWithoutServices = new DidDocument({
  id: did,
  verificationMethod: [ed25519VerificationMethod],
  authentication: [ed25519VerificationMethod.id],
})

describe('getMediationRecordForDidDocument', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('finds a v1 mediation record by the keyAgreement keys of a DIDComm v2 only document', async () => {
    mockFunction(mediationRecipientService.findAllMediatorsByQuery).mockImplementation(async (_, query) =>
      'recipientKeys' in query && query.recipientKeys?.includes(x25519Base58) ? [mediationRecord] : []
    )

    expect(await getMediationRecordForDidDocument(agentContext, v2OnlyDidDocument)).toBe(mediationRecord)

    expect(mediationRecipientService.findAllMediatorsByQuery).toHaveBeenCalledWith(agentContext, {
      recipientKeys: [x25519Base58],
    })
  })

  test('finds a v2 mediation record by the DID itself', async () => {
    mockFunction(mediationRecipientService.findAllMediatorsByQuery).mockImplementation(async (_, query) =>
      'recipientDids' in query && query.recipientDids?.includes(did) ? [mediationRecord] : []
    )

    expect(await getMediationRecordForDidDocument(agentContext, v2OnlyDidDocument)).toBe(mediationRecord)

    expect(mediationRecipientService.findAllMediatorsByQuery).toHaveBeenCalledTimes(1)
    expect(mediationRecipientService.findAllMediatorsByQuery).toHaveBeenCalledWith(agentContext, {
      recipientDids: [did],
    })
  })

  test('does not query with an empty key list, which would match every mediation record', async () => {
    // Every key query, including one with an empty list, finds a record
    mockFunction(mediationRecipientService.findAllMediatorsByQuery).mockImplementation(async (_, query) =>
      'recipientKeys' in query ? [mediationRecord] : []
    )

    expect(await getMediationRecordForDidDocument(agentContext, didDocumentWithoutServices)).toBeUndefined()

    expect(mediationRecipientService.findAllMediatorsByQuery).toHaveBeenCalledTimes(1)
    expect(mediationRecipientService.findAllMediatorsByQuery).not.toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({ recipientKeys: [] })
    )
  })
})
