import type { LdProofDetail, LdProofDetailOptions } from '../../../../../../src/modules/vc'
import type { CredentialService } from '../../../CredentialService'
import type { ProposeCredentialOptions } from '../../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type {
  FormatServiceProposeCredentialFormats,
  IndyProposeCredentialFormat,
} from '../../../formats/models/CredentialFormatServiceOptions'

import { W3cCredential } from '../../../../../../src/modules/vc/models'
import { JsonTransformer } from '../../../../../../src/utils'
import { getBaseConfig } from '../../../../../../tests/helpers'
import { Agent } from '../../../../../agent/Agent'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { CredentialsModule } from '../../../CredentialsModule'
import { CredentialFormatType } from '../../../CredentialsModuleOptions'
import { V1CredentialPreview } from '../../v1/V1CredentialPreview'
import { CredentialMessageBuilder } from '../CredentialMessageBuilder'

const { config, agentDependencies: dependencies } = getBaseConfig('Format Service Test')

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const TEST_DID_KEY = 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'

const testAttributes: IndyProposeCredentialFormat = {
  attributes: credentialPreview.attributes,
  payload: {
    schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    schemaName: 'ahoy',
    schemaVersion: '1.0',
    schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
    issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    credentialDefinitionId: 'GMm4vMw8LLrLJjp81kRRLp:3:CL:12:tag',
  },
}

const proposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V1,
  credentialFormats: {
    indy: testAttributes,
  },
  comment: 'v2 propose credential test',
}

const options: LdProofDetailOptions = {
  proofType: 'Ed25519Signature2018',
  verificationMethod:
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
}

const credential: W3cCredential = JsonTransformer.fromJSON(
  {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
    id: 'http://example.edu/credentials/temporary/28934792387492384',
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: TEST_DID_KEY,
    issuanceDate: '2017-10-22T12:23:48Z',
    credentialSubject: {
      id: 'did:example:b34ca6cd37bbf23',
      degree: {
        type: 'BachelorDegree',
        name: 'Bachelor of Science and Arts',
      },
    },
  },
  W3cCredential
)

const ldProof: LdProofDetail = {
  credential: credential,
  options: options,
}

const jsonProposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V2,
  credentialFormats: {
    jsonld: ldProof,
  },
  comment: 'v2 propose credential test',
}

const multiFormatProposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V2,
  credentialFormats: {
    indy: testAttributes,
    jsonld: ldProof,
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

    test('returns the correct credential format service for jsonld', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialFormatType.JsonLd)
      expect(formatService).not.toBeNull()
      const type: string = formatService.constructor.name
      expect(type).toEqual('JsonLdCredentialFormatService')
    })

    test('propose credential format service returns correct format and filters~attach (indy)', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialFormatType.Indy)
      const { format: formats, attachment: filtersAttach } = formatService.createProposal(proposal)

      expect(formats.attachId.length).toBeGreaterThan(0)
      expect(formats.format).toEqual('hlindy/cred-filter@v2.0')
      expect(filtersAttach).toBeTruthy()
    })

    test('propose credential format service returns correct format and filters~attach (jsonld)', () => {
      const version: CredentialProtocolVersion = CredentialProtocolVersion.V2
      const service: CredentialService = api.getService(version)
      const formatService: CredentialFormatService = service.getFormatService(CredentialFormatType.JsonLd)
      const { format: formats, attachment: filtersAttach } = formatService.createProposal(jsonProposal)

      expect(formats.attachId.length).toBeGreaterThan(0)
      expect(formats.format).toEqual('aries/ld-proof-vc-detail@v1.0')
      expect(filtersAttach).toBeTruthy()
    })
    test('propose credential format service transforms and validates CredPropose payload correctly', () => {
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

      const credFormats: FormatServiceProposeCredentialFormats =
        multiFormatProposal.credentialFormats as FormatServiceProposeCredentialFormats
      const formats: CredentialFormatService[] = service.getFormats(credFormats)
      expect(formats.length).toBe(2) // for now will be added to with jsonld
      const messageBuilder: CredentialMessageBuilder = new CredentialMessageBuilder()

      const v2Proposal = messageBuilder.createProposal(formats, multiFormatProposal)

      expect(v2Proposal.message.formats.length).toBe(2)
      expect(v2Proposal.message.formats[0].format).toEqual('hlindy/cred-filter@v2.0')
      expect(v2Proposal.message.formats[1].format).toEqual('aries/ld-proof-vc-detail@v1.0')
    })
  })
})
