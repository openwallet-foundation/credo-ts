import { CredentialProtocolVersion } from '../../CredentialProtocolVersion'
import { CredentialService } from '../../CredentialService'
import { CredentialFormatService } from '../formats/CredentialFormatService'
import { getBaseConfig } from '../../../../../tests/helpers'
import { CredentialsAPI } from '../../CredentialsAPI'
import { Agent } from '../../../../agent/Agent'
import { CredentialRecordType } from '../CredentialExchangeRecord'
import { AcceptProposalOptions, ProposeCredentialOptions } from '../interfaces'
import { unitTestLogger } from '../../../../logger'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { LinkedAttachment } from '../../../../utils/LinkedAttachment'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { assert } from 'console'
const { config, agentDependencies: dependencies } = getBaseConfig('Format Servive Test')

const TEST_INDY_FILTER = {
  schemaId: "GMm4vMw8LLrLJjp81kRRLp:2:ahoy:1560364003.0",
  cred_def_id: "GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag",
}

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const proposal: ProposeCredentialOptions = {
  connectionId: "",
  protocolVersion: CredentialProtocolVersion.V1_0,
  credentialFormats: {
    indy: {
      attributes: credentialPreview.attributes,
      schemaIssuerDid: "GMm4vMw8LLrLJjp81kRRLp",
      schemaName: "ahoy",
      schemaVersion: "1.0",
      schemaId: "1560364003",
      issuerDid: "GMm4vMw8LLrLJjp81kRRLp",
      credentialDefinitionId: "GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag",
      linkedAttachments: [
        new LinkedAttachment({
          name: 'profile_picture',
          attachment: new Attachment({
            mimeType: 'image/png',
            data: new AttachmentData({ base64: 'base64encodedpic' }),
          }),
        }),
      ],

    }
  },
  comment: "v2 propose credential test"
}


const offer: AcceptProposalOptions = {
  connectionId: "",
  protocolVersion: CredentialProtocolVersion.V1_0,
  credentialRecordId: "",
  comment: "v2 offer credential as response test",

  credentialFormats: {
    indy: {
      attributes: credentialPreview.attributes,
    }
  },
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
      let type: string = formatService.getType()
      expect(type).toEqual("IndyCredentialFormatService")
    })


    test('propose credential format service returns correct format and filters~attach', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)
      const { formats, filtersAttach } = formatService.getCredentialProposeAttachFormats(proposal, 'CRED_20_PROPOSAL')

      expect(formats.attachId).toEqual("indy")
      expect(formats.format).toEqual("hlindy/cred-filter@v2.0")
      unitTestLogger("1. formats = ", formats)

      unitTestLogger("2. filtersAttach = ", filtersAttach)
      expect(filtersAttach).toBeTruthy()
      
    })

    test('offer credential format service returns correct preview, format and offers~attach', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2_0
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialRecordType.INDY)
      const { preview, formats, offersAttach } = formatService.getCredentialOfferAttachFormats(offer, 'CRED_20_OFFER')

      expect(preview?.type).toEqual("https://didcomm.org/issue-credential/2.0/credential-preview") 
      expect(preview?.attributes.length).toEqual(2)

      unitTestLogger("1. preview = ", preview)

      expect(formats.attachId).toEqual("indy")
      expect(formats.format).toEqual("hlindy/cred-abstract@v2.0")
      unitTestLogger("2. formats = ", formats)

      unitTestLogger("3. offersAttach = ", offersAttach)
      expect(offersAttach).toBeTruthy()
      if (offersAttach) {
        expect(offersAttach.length).toEqual(1)
      }
      
    })

  })

  
})


