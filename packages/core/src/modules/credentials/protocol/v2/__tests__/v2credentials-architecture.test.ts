import type { CredentialService } from '../../../CredentialService'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { ProposeCredentialOptions } from '../../../interfaces'

import { getBaseConfig } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialsModule } from '../../../CredentialsModule'
import { CredentialFormatType } from '../../../interfaces'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { CredentialMessageBuilder } from '../CredentialMessageBuilder'

const { config, agentDependencies: dependencies } = getBaseConfig('Format Servive Test')

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})
const testAttributes = {
  attributes: credentialPreview.attributes,
  schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
  schemaName: 'ahoy',
  schemaVersion: '1.0',
  schemaId: '1560364003',
  issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
  credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
}
const proposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V1,
  credentialFormats: {
    indy: {
      payload: {
        credentialPayload: testAttributes,
      },
    },
  },
  comment: 'v2 propose credential test',
}

const multiFormatProposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V2,
  credentialFormats: {
    indy: {
      payload: {
        credentialPayload: testAttributes,
      },
    },
    // jsonld: {
    //   credential: {
    //     '@context': 'https://www.w3.org/2018/',
    //     issuer: 'did:key:z6MkodKV3mnjQQMB9jhMZtKD9Sm75ajiYq51JDLuRSPZTXrr',
    //     type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    //     issuanceDate: '2020-01-01T19:23:24Z',
    //     expirationDate: '2021-01-01T19:23:24Z',
    //     credentialSubject: {
    //       id: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
    //       degree: {
    //         type: 'BachelorDegree',
    //         name: 'Bachelor of Science and Arts',
    //       },
    //     },
    //   },
    //   options: {
    //     proofPurpose: 'assertionMethod',
    //     created: '2020-04-02T18:48:36Z',
    //     domain: 'example.com',
    //     challenge: '9450a9c1-4db5-4ab9-bc0c-b7a9b2edac38',
    //     proofType: 'Ed25519Signature2018',
    //   },
    // },
  },
  comment: 'v2 propose credential test',
}

describe('V2 Credential Architecture', () => {
  const agent = new Agent(config, dependencies)
  const container = agent.injectionContainer
  const api = container.resolve(CredentialsModule)

  describe('Credential Service', () => {
    test('returns the correct credential service for a protocol version 1.0', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V1
      expect(container.resolve(CredentialsModule)).toBeInstanceOf(CredentialsModule)
      const service: CredentialService = api.getService(version)
      expect(service.getVersion()).toEqual(CredentialProtocolVersion.V1)
    })

    test('returns the correct credential service for a protocol version 2.0', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      expect(service.getVersion()).toEqual(CredentialProtocolVersion.V2)
    })
  })

  describe('Credential Format Service', () => {
    test('returns the correct credential format service for indy', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialFormatType.Indy)
      expect(formatService).not.toBeNull()
      const type: string = formatService.constructor.name
      expect(type).toEqual('IndyCredentialFormatService')
    })

    test('propose credential format service returns correct format and filters~attach', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialFormatType.Indy)
      const { format: formats, attachment: filtersAttach } = formatService.createProposal(proposal)

      expect(formats.attachId.length).toBeGreaterThan(0)
      expect(formats.format).toEqual('hlindy/cred-filter@v2.0')
      expect(filtersAttach).toBeTruthy()
    })
    test('propose credential format service creates message with multiple formats', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)

      const formats: CredentialFormatService[] = service.getFormats(multiFormatProposal.credentialFormats)
      expect(formats.length).toBe(1) // for now will be added to with jsonld
      const messageBuilder: CredentialMessageBuilder = new CredentialMessageBuilder()

      const v2Proposal = messageBuilder.createProposal(formats, multiFormatProposal)

      expect(v2Proposal.message.formats.length).toBe(1)
      expect(v2Proposal.message.formats[0].format).toEqual('hlindy/cred-filter@v2.0')
      // expect(v2Proposal.message.formats[1].format).toEqual('aries/ld-proof-vc-detail@v1.0')
    })
  })
})
