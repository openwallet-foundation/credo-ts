import type {
  AnonCredsCredentialDefinition,
  AnonCredsCredentialRequestMetadata,
  AnonCredsProofRequest,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsSchema,
  AnonCredsSelectedCredentials,
} from '@credo-ts/anoncreds'
import type { JsonObject } from '@hyperledger/anoncreds-shared'

import {
  ConsoleLogger,
  DidResolverService,
  DidsModuleConfig,
  Ed25519Signature2018,
  InjectionSymbols,
  KeyType,
  SignatureSuiteToken,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cCredentialSubject,
  W3cCredentialsModuleConfig,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import { RevocationRegistryDefinition, anoncreds } from '@hyperledger/anoncreds-nodejs'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { AnonCredsCredentialDefinitionRepository } from '../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsLinkSecretRepository } from '../../../../anoncreds/src/repository/AnonCredsLinkSecretRepository'
import { InMemoryAnonCredsRegistry } from '../../../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { agentDependencies, getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { AnonCredsRsHolderService } from '../AnonCredsRsHolderService'

import {
  createCredentialDefinition,
  createCredentialForHolder,
  createCredentialOffer,
  createLinkSecret,
} from './helpers'

import {
  AnonCredsModuleConfig,
  AnonCredsHolderServiceSymbol,
  AnonCredsLinkSecretRecord,
  AnonCredsCredentialRecord,
} from '@credo-ts/anoncreds'

const agentConfig = getAgentConfig('AnonCredsRsHolderServiceTest')
const anonCredsHolderService = new AnonCredsRsHolderService()

jest.mock('../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository')
const CredentialDefinitionRepositoryMock =
  AnonCredsCredentialDefinitionRepository as jest.Mock<AnonCredsCredentialDefinitionRepository>
const credentialDefinitionRepositoryMock = new CredentialDefinitionRepositoryMock()

jest.mock('../../../../anoncreds/src/repository/AnonCredsLinkSecretRepository')
const AnonCredsLinkSecretRepositoryMock = AnonCredsLinkSecretRepository as jest.Mock<AnonCredsLinkSecretRepository>
const anoncredsLinkSecretRepositoryMock = new AnonCredsLinkSecretRepositoryMock()

jest.mock('../../../../core/src/modules/vc/repository/W3cCredentialRepository')
const W3cCredentialRepositoryMock = W3cCredentialRepository as jest.Mock<W3cCredentialRepository>
const w3cCredentialRepositoryMock = new W3cCredentialRepositoryMock()

const inMemoryStorageService = new InMemoryStorageService()
const logger = new ConsoleLogger()

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [AnonCredsCredentialDefinitionRepository, credentialDefinitionRepositoryMock],
    [AnonCredsLinkSecretRepository, anoncredsLinkSecretRepositoryMock],
    [W3cCredentialRepository, w3cCredentialRepositoryMock],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        registries: [new InMemoryAnonCredsRegistry({})],
        anoncreds,
      }),
    ],
    [InjectionSymbols.Logger, logger],
    [DidResolverService, new DidResolverService(logger, new DidsModuleConfig())],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
    [
      SignatureSuiteToken,
      {
        suiteClass: Ed25519Signature2018,
        proofType: 'Ed25519Signature2018',
        verificationMethodTypes: [
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
        ],
        keyTypes: [KeyType.Ed25519],
      },
    ],
  ],
  agentConfig,
})

describe('AnonCredsRsHolderService', () => {
  const getByCredentialIdMock = jest.spyOn(w3cCredentialRepositoryMock, 'getByCredentialId')
  const findByQueryMock = jest.spyOn(w3cCredentialRepositoryMock, 'findByQuery')

  beforeEach(() => {
    getByCredentialIdMock.mockClear()
  })

  test('createCredentialRequest', async () => {
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

  test('createLinkSecret', async () => {
    let linkSecret = await anonCredsHolderService.createLinkSecret(agentContext, {
      linkSecretId: 'linkSecretId',
    })

    expect(linkSecret.linkSecretId).toBe('linkSecretId')
    expect(linkSecret.linkSecretValue).toBeDefined()

    linkSecret = await anonCredsHolderService.createLinkSecret(agentContext)

    expect(linkSecret.linkSecretId).toBeDefined()
    expect(linkSecret.linkSecretValue).toBeDefined()
  })

  test('createProof', async () => {
    const proofRequest: AnonCredsProofRequest = {
      nonce: anoncreds.generateNonce(),
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
      credentialDefinition: personCredentialDefinition as unknown as JsonObject,
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
      credentialDefinition: phoneCredentialDefinition as unknown as JsonObject,
      schemaId: 'phoneschema:uri',
      credentialDefinitionId: 'phonecreddef:uri',
      credentialDefinitionPrivate: phoneCredentialDefinitionPrivate,
      keyCorrectnessProof: phoneKeyCorrectnessProof,
      linkSecret,
      linkSecretId: 'linkSecretId',
      credentialId: 'phoneCredId',
      revocationRegistryDefinitionId: 'phonerevregid:uri',
    })

    const selectedCredentials: AnonCredsSelectedCredentials = {
      selfAttestedAttributes: { attr5_referent: 'football' },
      attributes: {
        attr1_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
        attr2_referent: { credentialId: 'phoneCredId', credentialInfo: phoneCredentialInfo, revealed: true },
        attr3_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
        attr4_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo, revealed: true },
      },
      predicates: {
        predicate1_referent: { credentialId: 'personCredId', credentialInfo: personCredentialInfo },
      },
    }

    getByCredentialIdMock.mockResolvedValueOnce(
      new W3cCredentialRecord({
        credential: personCredential,
        tags: {},
        anonCredsCredentialRecordOptions: {
          credentialId: 'personCredId',
          linkSecretId: 'linkSecretId',
          schemaIssuerId: 'schemaIssuerDid',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          methodName: 'inMemory',
          schemaId: personCredentialInfo.schemaId,
          credentialDefinitionId: personCredentialInfo.credentialDefinitionId,
          revocationRegistryId: personCredentialInfo.revocationRegistryId ?? undefined,
        },
      })
    )
    getByCredentialIdMock.mockResolvedValueOnce(
      new W3cCredentialRecord({
        credential: phoneCredential,
        tags: {},
        anonCredsCredentialRecordOptions: {
          credentialId: 'phoneCredId',
          linkSecretId: 'linkSecretId',
          schemaIssuerId: 'schemaIssuerDid',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          methodName: 'inMemory',
          schemaId: phoneCredentialInfo.schemaId,
          credentialDefinitionId: phoneCredentialInfo.credentialDefinitionId,
          revocationRegistryId: phoneCredentialInfo.revocationRegistryId ?? undefined,
        },
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

    await anonCredsHolderService.createProof(agentContext, {
      credentialDefinitions: {
        'personcreddef:uri': personCredentialDefinition as AnonCredsCredentialDefinition,
        'phonecreddef:uri': phoneCredentialDefinition as AnonCredsCredentialDefinition,
      },
      proofRequest,
      selectedCredentials,
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

    expect(getByCredentialIdMock).toHaveBeenCalledTimes(2)
    // TODO: check proof object
  })

  describe('getCredentialsForProofRequest', () => {
    const findByQueryMock = jest.spyOn(w3cCredentialRepositoryMock, 'findByQuery')

    const proofRequest: AnonCredsProofRequest = {
      nonce: anoncreds.generateNonce(),
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
          restrictions: [{ schema_id: 'schemaid:uri', schema_name: 'schemaName' }, { schema_version: '1.0' }],
        },
        attr4_referent: {
          names: ['name', 'height'],
          restrictions: [{ cred_def_id: 'crededefid:uri', issuer_id: 'issuerid:uri' }],
        },
        attr5_referent: {
          name: 'name',
          restrictions: [{ 'attr::name::value': 'Alice', 'attr::name::marker': '1' }],
        },
      },
      requested_predicates: {
        predicate1_referent: { name: 'age', p_type: '>=' as const, p_value: 18 },
      },
    }

    beforeEach(() => {
      findByQueryMock.mockResolvedValue([])
    })

    afterEach(() => {
      findByQueryMock.mockClear()
    })

    test('invalid referent', async () => {
      await expect(
        anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
          proofRequest,
          attributeReferent: 'name',
        })
      ).rejects.toThrowError()
    })

    test('referent with single restriction', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'attr1_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::name::marker': true,
          },
          {
            unqualifiedIssuerId: 'issuer:uri',
          },
        ],
      })
    })

    test('referent without restrictions', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'attr2_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::phoneNumber::marker': true,
          },
        ],
      })
    })

    test('referent with multiple, complex restrictions', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'attr3_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::age::marker': true,
          },
          {
            $or: [{ unqualifiedSchemaId: 'schemaid:uri', schemaName: 'schemaName' }, { schemaVersion: '1.0' }],
          },
        ],
      })
    })

    test('referent with multiple names and restrictions', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'attr4_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::name::marker': true,
            'attr::height::marker': true,
          },
          {
            unqualifiedCredentialDefinitionId: 'crededefid:uri',
            unqualifiedIssuerId: 'issuerid:uri',
          },
        ],
      })
    })

    test('referent with attribute values and marker restriction', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'attr5_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::name::marker': true,
          },
          {
            'attr::name::value': 'Alice',
            'attr::name::marker': true,
          },
        ],
      })
    })

    test('predicate referent', async () => {
      await anonCredsHolderService.getCredentialsForProofRequest(agentContext, {
        proofRequest,
        attributeReferent: 'predicate1_referent',
      })

      expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
        $and: [
          {
            'attr::age::marker': true,
          },
        ],
      })
    })
  })

  test('deleteCredential', async () => {
    getByCredentialIdMock.mockRejectedValueOnce(new Error())
    getByCredentialIdMock.mockResolvedValueOnce(
      new W3cCredentialRecord({
        credential: {} as W3cJsonLdVerifiableCredential,
        tags: {},
        anonCredsCredentialRecordOptions: {
          credentialId: 'personCredId',
          linkSecretId: 'linkSecretId',
          schemaIssuerId: 'schemaIssuerDid',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          methodName: 'inMemory',
          schemaId: 'schemaId',
          credentialDefinitionId: 'credDefId',
          revocationRegistryId: 'revRegId',
        },
      })
    )

    expect(anonCredsHolderService.deleteCredential(agentContext, 'credentialId')).rejects.toThrowError()

    await anonCredsHolderService.deleteCredential(agentContext, 'credentialId')

    expect(getByCredentialIdMock).toHaveBeenCalledWith(agentContext, 'credentialId')
  })

  test('get single Credential', async () => {
    getByCredentialIdMock.mockRejectedValueOnce(new Error())

    getByCredentialIdMock.mockResolvedValueOnce(
      new W3cCredentialRecord({
        credential: new W3cJsonLdVerifiableCredential({
          credentialSubject: new W3cCredentialSubject({ claims: { attr1: 'value1', attr2: 'value2' } }),
          issuer: 'test',
          issuanceDate: Date.now().toString(),
          type: ['VerifiableCredential'],
          proof: {
            created: Date.now().toString(),
            type: 'test',
            proofPurpose: 'test',
            verificationMethod: 'test',
          },
        }),
        tags: {},
        anonCredsCredentialRecordOptions: {
          credentialId: 'myCredentialId',
          credentialRevocationId: 'credentialRevocationId',
          linkSecretId: 'linkSecretId',
          schemaIssuerId: 'schemaIssuerDid',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          methodName: 'inMemory',
          schemaId: 'schemaId',
          credentialDefinitionId: 'credDefId',
          revocationRegistryId: 'revRegId',
        },
      })
    )

    expect(
      anonCredsHolderService.getCredential(agentContext, { credentialId: 'myCredentialId' })
    ).rejects.toThrowError()

    const credentialInfo = await anonCredsHolderService.getCredential(agentContext, { credentialId: 'myCredentialId' })

    expect(credentialInfo).toMatchObject({
      attributes: { attr1: 'value1', attr2: 'value2' },
      credentialDefinitionId: 'credDefId',
      credentialId: 'myCredentialId',
      revocationRegistryId: 'revRegId',
      schemaId: 'schemaId',
      credentialRevocationId: 'credentialRevocationId',
    })
  })

  test('getCredentials', async () => {
    findByQueryMock.mockResolvedValueOnce([
      new W3cCredentialRecord({
        credential: new W3cJsonLdVerifiableCredential({
          credentialSubject: new W3cCredentialSubject({ claims: { attr1: 'value1', attr2: 'value2' } }),
          issuer: 'test',
          issuanceDate: Date.now().toString(),
          type: ['VerifiableCredential'],
          proof: {
            created: Date.now().toString(),
            type: 'test',
            proofPurpose: 'test',
            verificationMethod: 'test',
          },
        }),
        tags: {},
        anonCredsCredentialRecordOptions: {
          credentialId: 'myCredentialId',
          credentialRevocationId: 'credentialRevocationId',
          linkSecretId: 'linkSecretId',
          schemaIssuerId: 'schemaIssuerDid',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          methodName: 'inMemory',
          schemaId: 'schemaId',
          credentialDefinitionId: 'credDefId',
          revocationRegistryId: 'revRegId',
        },
      }),
    ])

    const credentialInfo = await anonCredsHolderService.getCredentials(agentContext, {
      credentialDefinitionId: 'credDefId',
      schemaId: 'schemaId',
      schemaIssuerId: 'schemaIssuerDid',
      schemaName: 'schemaName',
      schemaVersion: 'schemaVersion',
      issuerId: 'issuerDid',
      methodName: 'inMemory',
    })

    expect(findByQueryMock).toHaveBeenCalledWith(agentContext, {
      unqualifiedCredentialDefinitionId: 'credDefId',
      unqualifiedSchemaId: 'schemaId',
      unqualifiedSchemaIssuerId: 'schemaIssuerDid',
      unqualifiedIssuerId: 'issuerDid',
      schemaName: 'schemaName',
      schemaVersion: 'schemaVersion',
      methodName: 'inMemory',
    })
    expect(credentialInfo).toMatchObject([
      {
        attributes: { attr1: 'value1', attr2: 'value2' },
        credentialDefinitionId: 'credDefId',
        credentialId: 'myCredentialId',
        revocationRegistryId: 'revRegId',
        schemaId: 'schemaId',
        credentialRevocationId: 'credentialRevocationId',
      },
    ])
  })

  test('storeCredential', async () => {
    const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } = createCredentialDefinition({
      attributeNames: ['name', 'age', 'sex', 'height'],
      issuerId: 'issuer:uri',
    })

    const linkSecret = createLinkSecret()

    mockFunction(anoncredsLinkSecretRepositoryMock.getByLinkSecretId).mockResolvedValue(
      new AnonCredsLinkSecretRecord({ linkSecretId: 'linkSecretId', value: linkSecret })
    )

    const schema: AnonCredsSchema = {
      attrNames: ['name', 'sex', 'height', 'age'],
      issuerId: 'did:indy:sovrin:7Tqg6BwSSWapxgUDm9KKgg',
      name: 'schemaName',
      version: '1',
    }

    const { credential, revocationRegistryDefinition, credentialRequestMetadata } = createCredentialForHolder({
      attributes: {
        name: 'John',
        sex: 'M',
        height: '179',
        age: '19',
      },
      credentialDefinition: credentialDefinition as unknown as JsonObject,
      schemaId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/credentialDefinition-name/1.0',
      credentialDefinitionId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default',
      credentialDefinitionPrivate,
      keyCorrectnessProof,
      linkSecret,
      linkSecretId: 'linkSecretId',
      credentialId: 'personCredId',
      revocationRegistryDefinitionId: 'did:indy:sovrin:test:12345/anoncreds/v0/REV_REG_DEF/420/someTag/anotherTag',
    })

    const saveCredentialMock = jest.spyOn(w3cCredentialRepositoryMock, 'save')

    saveCredentialMock.mockResolvedValue()

    const credentialId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition,
      credentialDefinitionId: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/CLAIM_DEF/104/default',
      credentialRequestMetadata: credentialRequestMetadata.toJson() as unknown as AnonCredsCredentialRequestMetadata,
      credentialId: 'personCredId',
      schema,
      revocationRegistry: {
        id: 'did:indy:sovrin:test:12345/anoncreds/v0/REV_REG_DEF/420/someTag/anotherTag',
        definition: new RevocationRegistryDefinition(
          revocationRegistryDefinition.handle
        ).toJson() as unknown as AnonCredsRevocationRegistryDefinition,
      },
    })

    expect(credentialId).toBe('personCredId')
    expect(saveCredentialMock).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        anonCredsCredentialMetadata: expect.objectContaining({
          credentialId: 'personCredId',
          linkSecretId: 'linkSecretId',
        }),
        // The stored credential is different from the one received originally
        _tags: expect.objectContaining({
          schemaName: 'schemaName',
          schemaIssuerId: 'did:indy:sovrin:7Tqg6BwSSWapxgUDm9KKgg',
          schemaVersion: '1',
        }),
      })
    )
  })
})
