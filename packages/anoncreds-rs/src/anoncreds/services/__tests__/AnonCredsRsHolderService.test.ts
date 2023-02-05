import type {
  AnonCredsCredentialDefinition,
  AnonCredsProofRequest,
  AnonCredsRequestedCredentials,
  AnonCredsRevocationList,
} from '@aries-framework/anoncreds'

import { AnonCredsHolderServiceSymbol, AnonCredsMasterSecretRecord } from '@aries-framework/anoncreds'
import { anoncreds, registerAnoncreds } from '@hyperledger/anoncreds-nodejs'
import { nativeAnoncreds } from '@hyperledger/anoncreds-nodejs/build/library'

import { AnonCredsCredentialDefinitionRepository } from '../../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsMasterSecretRepository } from '../../../../../anoncreds/src/repository/AnonCredsMasterSecretRepository'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../../core/tests/helpers'
import { AnonCredsCredentialRecord } from '../../repository/AnonCredsCredentialRecord'
import { AnonCredsCredentialRepository } from '../../repository/AnonCredsCredentialRepository'
import { AnonCredsRsHolderService } from '../AnonCredsRsHolderService'

import {
  createCredentialDefinition,
  createCredentialForHolder,
  createCredentialOffer,
  createMasterSecret,
} from './helpers'

registerAnoncreds({ lib: anoncreds })
nativeAnoncreds.anoncreds_set_default_logger()

const agentConfig = getAgentConfig('AnonCredsRsHolderServiceTest')
const anonCredsHolderService = new AnonCredsRsHolderService()

jest.mock('../../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository')
const CredentialDefinitionRepositoryMock =
  AnonCredsCredentialDefinitionRepository as jest.Mock<AnonCredsCredentialDefinitionRepository>
const credentialDefinitionRepositoryMock = new CredentialDefinitionRepositoryMock()

jest.mock('../../../../../anoncreds/src/repository/AnonCredsMasterSecretRepository')
const AnonCredsMasterSecretRepositoryMock =
  AnonCredsMasterSecretRepository as jest.Mock<AnonCredsMasterSecretRepository>
const anoncredsMasterSecretRepositoryMock = new AnonCredsMasterSecretRepositoryMock()

jest.mock('../../repository/AnonCredsCredentialRepository')
const AnonCredsCredentialRepositoryMock = AnonCredsCredentialRepository as jest.Mock<AnonCredsCredentialRepository>
const anoncredsCredentialRepositoryMock = new AnonCredsCredentialRepositoryMock()

const agentContext = getAgentContext({
  registerInstances: [
    [AnonCredsCredentialDefinitionRepository, credentialDefinitionRepositoryMock],
    [AnonCredsMasterSecretRepository, anoncredsMasterSecretRepositoryMock],
    [AnonCredsCredentialRepository, anoncredsCredentialRepositoryMock],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
  ],
  agentConfig,
})

describe('AnonCredsRsHolderService', () => {
  it('createCredentialRequest', async () => {
    mockFunction(anoncredsMasterSecretRepositoryMock.getByMasterSecretId).mockResolvedValue(
      new AnonCredsMasterSecretRecord({ masterSecretId: 'masterSecretId', value: createMasterSecret() })
    )

    const { credentialDefinition, keyCorrectnessProof } = createCredentialDefinition({
      attributeNames: ['phoneNumber'],
      issuerId: 'issuer:uri',
    })
    const credentialOffer = createCredentialOffer(keyCorrectnessProof)

    const { credentialRequest } = await anonCredsHolderService.createCredentialRequest(agentContext, {
      credentialDefinition,
      credentialOffer,
      masterSecretId: 'masterSecretId',
    })

    expect(credentialRequest.cred_def_id).toBe('creddef:uri')
    expect(credentialRequest.prover_did).toBeUndefined()
  })

  it('createMasterSecret', async () => {
    let masterSecret = await anonCredsHolderService.createMasterSecret(agentContext, {
      masterSecretId: 'masterSecretId',
    })

    expect(masterSecret.masterSecretId).toBe('masterSecretId')
    expect(masterSecret.masterSecretValue).toBeDefined()

    masterSecret = await anonCredsHolderService.createMasterSecret(agentContext, {}) // FIXME: use optional 'options'

    expect(masterSecret.masterSecretId).toBeDefined()
    expect(masterSecret.masterSecretValue).toBeDefined()
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

    const masterSecret = createMasterSecret()
    mockFunction(anoncredsMasterSecretRepositoryMock.getByMasterSecretId).mockResolvedValue(
      new AnonCredsMasterSecretRecord({ masterSecretId: 'masterSecretId', value: masterSecret })
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
      masterSecret,
      masterSecretId: 'masterSecretId',
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
        phoneNumber: 'masterSecretId56',
      },
      credentialDefinition: phoneCredentialDefinition,
      schemaId: 'phoneschema:uri',
      credentialDefinitionId: 'phonecreddef:uri',
      credentialDefinitionPrivate: phoneCredentialDefinitionPrivate,
      keyCorrectnessProof: phoneKeyCorrectnessProof,
      masterSecret,
      masterSecretId: 'masterSecretId',
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
        masterSecretId: 'masterSecretId',
      })
    )
    mockFunction(anoncredsCredentialRepositoryMock.getByCredentialId).mockResolvedValueOnce(
      new AnonCredsCredentialRecord({
        credential: phoneCredential,
        credentialId: 'phoneCredId',
        masterSecretId: 'masterSecretId',
      })
    )

    const revocationRegistries = {
      'personrevregid:uri': {
        tailsFilePath: personTailsPath,
        definition: JSON.parse(anoncreds.getJson({ objectHandle: personRevRegDef })),
        revocationLists: { '1': {} as AnonCredsRevocationList },
      },
      'phonerevregid:uri': {
        tailsFilePath: phoneTailsPath,
        definition: JSON.parse(anoncreds.getJson({ objectHandle: phoneRevRegDef })),
        revocationLists: { '1': {} as AnonCredsRevocationList },
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
