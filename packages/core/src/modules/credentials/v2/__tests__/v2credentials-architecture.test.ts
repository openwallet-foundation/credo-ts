import type { CredentialService } from '../../CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  V2CredOfferFormat,
  V2CredRequestFormat,
} from '../interfaces'
import type { CredOffer } from 'indy-sdk'

import { getBaseConfig } from '../../../../../tests/helpers'
import { Agent } from '../../../../agent/Agent'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { unitTestLogger } from '../../../../logger'
import { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialsAPI } from '../../CredentialsAPI'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { CredentialRecordType } from '../CredentialExchangeRecord'
import { INDY_ATTACH_ID } from '../formats/V2CredentialFormat'

const { config, agentDependencies: dependencies } = getBaseConfig('Format Servive Test')

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const proposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V1_0,
  credentialFormats: {
    indy: {
      attributes: credentialPreview.attributes,
      schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      schemaName: 'ahoy',
      schemaVersion: '1.0',
      schemaId: '1560364003',
      issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
      linkedAttachments: [
        new LinkedAttachment({
          name: 'profile_picture',
          attachment: new Attachment({
            mimeType: 'image/png',
            data: new AttachmentData({ base64: 'base64encodedpic' }),
          }),
        }),
      ],
    },
  },
  comment: 'v2 propose credential test',
}

const proof = { a: '' }

const credOffer: CredOffer = {
  schema_id: '',
  cred_def_id: '',
  nonce: '',
  key_correctness_proof: proof,
}

describe('V2 Credential Architecture', () => {
  const agent = new Agent(config, dependencies)
  const container = agent.injectionContainer
  const api = container.resolve(CredentialsAPI)

  describe('Credential Service', () => {
    test('returns the correct credential service for a protocol version 1.0', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V1_0
      expect(container.resolve(CredentialsAPI)).toBeInstanceOf(CredentialsAPI)
      const service: CredentialService = api.getService(version)
      expect(service.getVersion()).toEqual(CredentialProtocolVersion.V1_0)
    })

    test('returns the correct credential service for a protocol version 2.0', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      expect(service.getVersion()).toEqual(CredentialProtocolVersion.V2_0)
    })
  })

  describe('Credential Format Service', () => {
    test('returns the correct credential format service for indy', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)
      expect(formatService).not.toBeNull()
      const type: string = formatService.getType()
      expect(type).toEqual('IndyCredentialFormatService')
    })

    test('propose credential format service returns correct format and filters~attach', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)
      const { formats, filtersAttach } = formatService.getCredentialProposeAttachFormats(proposal, 'CRED_20_PROPOSAL')

      expect(formats.attachId).toEqual(INDY_ATTACH_ID)
      expect(formats.format).toEqual('hlindy/cred-filter@v2.0')
      unitTestLogger('1. formats = ', formats)

      unitTestLogger('2. filtersAttach = ', filtersAttach)
      expect(filtersAttach).toBeTruthy()
    })

    test('offer credential format service returns correct preview, format and offers~attach', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)

      const v2Offer: V2CredOfferFormat = {
        indy: {
          credentialOffer: credOffer,
        },
      }
      const options: AcceptProposalOptions = {
        connectionId: '',
        protocolVersion: CredentialProtocolVersion.V1_0,
        credentialRecordId: '',
        comment: 'v2 offer credential as response test',
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
          },
        },
      }
      const { preview, formats, offersAttach } = formatService.getCredentialOfferAttachFormats(
        options,
        v2Offer,
        'CRED_20_OFFER'
      )

      expect(preview?.type).toEqual('https://didcomm.org/issue-credential/2.0/credential-preview')
      expect(preview?.attributes.length).toEqual(2)

      unitTestLogger('1. preview = ', preview)

      expect(formats.attachId).toEqual(INDY_ATTACH_ID)
      expect(formats.format).toEqual('hlindy/cred-abstract@v2.0')
      unitTestLogger('2. formats = ', formats)

      unitTestLogger('3. offersAttach = ', offersAttach)
      expect(offersAttach).toBeTruthy()
      if (offersAttach) {
        expect(offersAttach.length).toEqual(1)
      }
    })
    test('request credential format service returns correct format and request~attach', async () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)

      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)

      // create Mock credential request for this test
      type StringProps = Record<'prop1', string>
      const a: StringProps = { prop1: 'o' }

      const credentialRequest: V2CredRequestFormat = {
        indy: {
          request: {
            prover_did: '',
            cred_def_id: '',
            blinded_ms: a,
            blinded_ms_correctness_proof: a,
            nonce: '',
          },
          requestMetaData: {},
        },
      }

      // format service -> create the request~attach component for the v2 request message
      const { formats, requestAttach } = formatService.getCredentialRequestAttachFormats(
        credentialRequest,
        'CRED_20_REQUEST'
      )

      expect(formats.attachId).toEqual(INDY_ATTACH_ID)
      expect(formats.format).toEqual('hlindy/cred-req@v2.0')
      unitTestLogger('1. formats = ', formats)

      unitTestLogger('2. requestAttach = ', requestAttach)
      expect(requestAttach).toBeTruthy()
      if (requestAttach) {
        expect(requestAttach.length).toEqual(1)
      }
    })
  })
})
