import type { ProposeCredentialOptions } from '../../../CredentialsModuleOptions'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type {
  FormatServiceProposeCredentialFormats,
  IndyProposeCredentialFormat,
} from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialService } from '../../../services/CredentialService'

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

const inputDoc = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/citizenship/v1',
    'https://w3id.org/security/bbs/v1',
  ],
  id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
  type: ['VerifiableCredential', 'PermanentResidentCard'],
  issuer: 'weidfhwefhew',
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

const signCredentialOptions = {
  credential,
  proofType: 'Ed25519Signature2018',
  verificationMethod: 'weprih2ofueb',
}

const jsonProposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V2,
  credentialFormats: {
    jsonld: signCredentialOptions,
  },
  comment: 'v2 propose credential test',
}

const multiFormatProposal: ProposeCredentialOptions = {
  connectionId: '',
  protocolVersion: CredentialProtocolVersion.V2,
  credentialFormats: {
    indy: testAttributes,
    jsonld: signCredentialOptions,
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
