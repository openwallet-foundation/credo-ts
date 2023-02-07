import type {
  AnonCredsCredentialDefinition,
  AnonCredsProofRequest,
  AnonCredsRequestedCredentials,
  AnonCredsRevocationStatusList,
} from '@aries-framework/anoncreds'

import {
  AnonCredsHolderServiceSymbol,
  AnonCredsLinkSecretRecord,
  AnonCredsCredentialRecord,
  AnonCredsCredentialRepository,
} from '@aries-framework/anoncreds'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { nativeAnoncreds } from '@hyperledger/anoncreds-nodejs/build/library'

import { AnonCredsCredentialDefinitionRepository } from '../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsLinkSecretRepository } from '../../../../anoncreds/src/repository/AnonCredsLinkSecretRepository'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { AnonCredsRsHolderService } from '../AnonCredsRsHolderService'

import {
  createCredentialDefinition,
  createCredentialForHolder,
  createCredentialOffer,
  createLinkSecret,
} from './helpers'

nativeAnoncreds.anoncreds_set_default_logger()

const agentConfig = getAgentConfig('AnonCredsRsHolderServiceTest')
const anonCredsHolderService = new AnonCredsRsHolderService()

jest.mock('../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository')
const CredentialDefinitionRepositoryMock =
  AnonCredsCredentialDefinitionRepository as jest.Mock<AnonCredsCredentialDefinitionRepository>
const credentialDefinitionRepositoryMock = new CredentialDefinitionRepositoryMock()

jest.mock('../../../../anoncreds/src/repository/AnonCredsLinkSecretRepository')
const AnonCredsLinkSecretRepositoryMock = AnonCredsLinkSecretRepository as jest.Mock<AnonCredsLinkSecretRepository>
const anoncredsLinkSecretRepositoryMock = new AnonCredsLinkSecretRepositoryMock()

jest.mock('../../../../anoncreds/src/repository/AnonCredsCredentialRepository')
const AnonCredsCredentialRepositoryMock = AnonCredsCredentialRepository as jest.Mock<AnonCredsCredentialRepository>
const anoncredsCredentialRepositoryMock = new AnonCredsCredentialRepositoryMock()

const agentContext = getAgentContext({
  registerInstances: [
    [AnonCredsCredentialDefinitionRepository, credentialDefinitionRepositoryMock],
    [AnonCredsLinkSecretRepository, anoncredsLinkSecretRepositoryMock],
    [AnonCredsCredentialRepository, anoncredsCredentialRepositoryMock],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
  ],
  agentConfig,
})

describe('AnonCredsRsHolderService', () => {
  it('createCredentialRequest', async () => {
    mockFunction(anoncredsLinkSecretRepositoryMock.getByLinkSecretId).mockResolvedValue(
      new AnonCredsLinkSecretRecord({ linkSecretId: 'linkSecretId', value: createLinkSecret() })
    )

    const { credentialDefinition, keyCorrectnessProof } = createCredentialDefinition({
      attributeNames: ['phoneNumber'],
      issuerId: 'issuer:uri',
    })
    const credentialOffer = createCredentialOffer(keyCorrectnessProof)

    const { credentialRequest } = await anonCredsHolderService.createCredentialRequest(agentContext, {
      credentialDefinition,
      credentialOffer,
      linkSecretId: 'linkSecretId',
    })

    expect(credentialRequest.cred_def_id).toBe('creddef:uri')
    expect(credentialRequest.prover_did).toBeUndefined()
  })

  it('createLinkSecret', async () => {
    let linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, {
      linkSecretId: 'linkSecretId',
    })

    expect(linkSecret.linkSecretId).toBe('linkSecretId')
    expect(linkSecret.linkSecretValue).toBeDefined()

    linkSecret = await anonCredsHolderService.createLinkSecret(agentContext)

    expect(linkSecret.linkSecretId).toBeDefined()
    expect(linkSecret.linkSecretValue).toBeDefined()
  })

  it('createProof', async () => {
    const {
      credentialDefinition: personCredentialDefinition,
      credentialDefinitionPrivate: personCredentialDefinitionPrivate,
      keyCorrectnessProof: personKeyCorrectnessProof,
    } = createCredentialDefinition({
      attributeNames: ['name', 'age', 'sex', 'height'],
      issuerId: 'issuer:uri',
    })

    const {
      credentialDefinition: phoneCredentialDefinition,
      credentialDefinitionPrivate: phoneCredentialDefinitionPrivate,
      keyCorrectnessProof: phoneKeyCorrectnessProof,
    } = createCredentialDefinition({
      attributeNames: ['phoneNumber'],
      issuerId: 'issuer:uri',
    })

    const nonce = anoncreds.generateNonce()

    const proofRequest: AnonCredsProofRequest = {
      nonce,
      name: 'pres_req_1',
      version: '0.1',
      requested_attributes: {
        attr1_referent: {
          name: 'name',
          restrictions: [{ issuer_did: 'issuer:uri' }],
        },
        attr2_referent: {
          name: 'phoneNumber',
        },
        attr3_referent: {
          name: 'age',
        },
        attr4_referent: {
          names: ['name', 'height'],
        },
        attr5_referent: {
          name: 'favouriteSport',
        },
      },
      requested_predicates: {
        predicate1_referent: { name: 'age', p_type: '>=' as const, p_value: 18 },
      },
      //non_revoked: { from: 10, to: 200 },
    }

    const linkSecret = createLinkSecret()
    mockFunction(anoncredsLinkSecretRepositoryMock.getByLinkSecretId).mockResolvedValue(
      new AnonCredsLinkSecretRecord({ linkSecretId: 'linkSecretId', value: linkSecret })
    )

    const {
      credential: personCredential,
      credentialInfo: personCredentialInfo,
      revocationRegistryDefinition: personRevRegDef,
      tailsPath: personTailsPath,
    } = createCredentialForHolder({
      attributes: {
        name: 'John',
        sex: 'M',
        height: '179',
        age: '19',
      },
      credentialDefinition: personCredentialDefinition,
      schemaId: 'personschema:uri',
      credentialDefinitionId: 'personcreddef:uri',
      credentialDefinitionPrivate: personCredentialDefinitionPrivate,
      keyCorrectnessProof: personKeyCorrectnessProof,
      linkSecret,
      linkSecretId: 'linkSecretId',
      credentialId: 'personCredId',
      revocationRegistryDefinitionId: 'personrevregid:uri',
    })

    const {
      credential: phoneCredential,
      credentialInfo: phoneCredentialInfo,
      revocationRegistryDefinition: phoneRevRegDef,
      tailsPath: phoneTailsPath,
    } = createCredentialForHolder({
      attributes: {
        phoneNumber: 'linkSecretId56',
      },
      credentialDefinition: phoneCredentialDefinition,
      schemaId: 'phoneschema:uri',
      credentialDefinitionId: 'phonecreddef:uri',
      credentialDefinitionPrivate: phoneCredentialDefinitionPrivate,
      keyCorrectnessProof: phoneKeyCorrectnessProof,
      linkSecret,
      linkSecretId: 'linkSecretId',
      credentialId: 'phoneCredId',
      revocationRegistryDefinitionId: 'phonerevregid:uri',
    })

    const requestedCredentials: AnonCredsRequestedCredentials = {
      selfAttestedAttributes: { attr5_referent: 'football' },
      requestedAttributes: {
        attr1_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
        attr2_referent: { credentialId: 'phoneCredId', credentialInfo: phoneCredentialInfo, revealed: true },
        attr3_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
        attr4_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
      },
      requestedPredicates: {
        predicate1_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo },
      },
    }

    mockFunction(anoncredsCredentialRepositoryMock.getByCredentialId).mockResolvedValueOnce(
      new AnonCredsCredentialRecord({
        credential: personCredential,
        credentialId: 'personCredId',
        linkSecretId: 'linkSecretId',
        issuerDid: 'issuerDid',
        schemaIssuerDid: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
      })
    )
    mockFunction(anoncredsCredentialRepositoryMock.getByCredentialId).mockResolvedValueOnce(
      new AnonCredsCredentialRecord({
        credential: phoneCredential,
        credentialId: 'phoneCredId',
        linkSecretId: 'linkSecretId',
        issuerDid: 'issuerDid',
        schemaIssuerDid: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
      })
    )

    const revocationRegistries = {
      'personrevregid:uri': {
        tailsFilePath: personTailsPath,
        definition: JSON.parse(anoncreds.getJson({ objectHandle: personRevRegDef })),
        revocationStatusLists: { '1': {} as AnonCredsRevocationStatusList },
      },
      'phonerevregid:uri': {
        tailsFilePath: phoneTailsPath,
        definition: JSON.parse(anoncreds.getJson({ objectHandle: phoneRevRegDef })),
        revocationStatusLists: { '1': {} as AnonCredsRevocationStatusList },
      },
    }

    const proof = await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: {
        'personcreddef:uri': personCredentialDefinition as AnonCredsCredentialDefinition,
        'phonecreddef:uri': phoneCredentialDefinition as AnonCredsCredentialDefinition,
      },
      proofRequest,
      requestedCredentials,
      schemas: {
        'phoneschema:uri': { attrNames: ['phoneNumber'], issuerId: 'issuer:uri', name: 'phoneschema', version: '1' },
        'personschema:uri': {
          attrNames: ['name', 'sex', 'height', 'age'],
          issuerId: 'issuer:uri',
          name: 'personschema',
          version: '1',
        },
      },
      revocationRegistries,
    })

    // TODO: check proof object
  })

  it.todo('deleteCredential')

  it.todo('getCredential')

  it.todo('getCredentialsForProofRequest')

  it.todo('storeCredential')
})
