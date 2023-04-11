import type {
  AnonCredsCredentialDefinition,
  AnonCredsProofRequest,
  AnonCredsRevocationStatusList,
  AnonCredsCredential,
  AnonCredsSchema,
  AnonCredsSelectedCredentials,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsCredentialRequestMetadata,
} from '@aries-framework/anoncreds'
import type { JsonObject } from '@hyperledger/anoncreds-nodejs'

import {
  AnonCredsModuleConfig,
  AnonCredsHolderServiceSymbol,
  AnonCredsLinkSecretRecord,
  AnonCredsCredentialRecord,
} from '@aries-framework/anoncreds'
import { anoncreds, RevocationRegistryDefinition } from '@hyperledger/anoncreds-nodejs'

import { describeRunInNodeVersion } from '../../../../../tests/runInVersion'
import { AnonCredsCredentialDefinitionRepository } from '../../../../anoncreds/src/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsCredentialRepository } from '../../../../anoncreds/src/repository/AnonCredsCredentialRepository'
import { AnonCredsLinkSecretRepository } from '../../../../anoncreds/src/repository/AnonCredsLinkSecretRepository'
import { InMemoryAnonCredsRegistry } from '../../../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../../core/tests/helpers'
import { AnonCredsRsHolderService } from '../AnonCredsRsHolderService'

import {
  createCredentialDefinition,
  createCredentialForHolder,
  createCredentialOffer,
  createLinkSecret,
} from './helpers'

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
    [
      AnonCredsModuleConfig,
      new AnonCredsModuleConfig({
        registries: [new InMemoryAnonCredsRegistry({})],
      }),
    ],
  ],
  agentConfig,
})

// FIXME: Re-include in tests when NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'AnonCredsRsHolderService', () => {
  const getByCredentialIdMock = jest.spyOn(anoncredsCredentialRepositoryMock, 'getByCredentialId')
  const findByQueryMock = jest.spyOn(anoncredsCredentialRepositoryMock, 'findByQuery')

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
      new AnonCredsCredentialRecord({
        credential: personCredential,
        credentialId: 'personCredId',
        linkSecretId: 'linkSecretId',
        issuerId: 'issuerDid',
        schemaIssuerId: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        methodName: 'inMemory',
      })
    )
    getByCredentialIdMock.mockResolvedValueOnce(
      new AnonCredsCredentialRecord({
        credential: phoneCredential,
        credentialId: 'phoneCredId',
        linkSecretId: 'linkSecretId',
        issuerId: 'issuerDid',
        schemaIssuerId: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        methodName: 'inMemory',
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
    const findByQueryMock = jest.spyOn(anoncredsCredentialRepositoryMock, 'findByQuery')

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
            issuerId: 'issuer:uri',
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
            $or: [{ schemaId: 'schemaid:uri', schemaName: 'schemaName' }, { schemaVersion: '1.0' }],
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
            credentialDefinitionId: 'crededefid:uri',
            issuerId: 'issuerid:uri',
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
      new AnonCredsCredentialRecord({
        credential: {} as AnonCredsCredential,
        credentialId: 'personCredId',
        linkSecretId: 'linkSecretId',
        issuerId: 'issuerDid',
        schemaIssuerId: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        methodName: 'inMemory',
      })
    )

    expect(anonCredsHolderService.deleteCredential(agentContext, 'credentialId')).rejects.toThrowError()

    await anonCredsHolderService.deleteCredential(agentContext, 'credentialId')

    expect(getByCredentialIdMock).toHaveBeenCalledWith(agentContext, 'credentialId')
  })

  test('getCredential', async () => {
    getByCredentialIdMock.mockRejectedValueOnce(new Error())

    getByCredentialIdMock.mockResolvedValueOnce(
      new AnonCredsCredentialRecord({
        credential: {
          cred_def_id: 'credDefId',
          schema_id: 'schemaId',
          signature: 'signature',
          signature_correctness_proof: 'signatureCorrectnessProof',
          values: { attr1: { raw: 'value1', encoded: 'encvalue1' }, attr2: { raw: 'value2', encoded: 'encvalue2' } },
          rev_reg_id: 'revRegId',
        } as AnonCredsCredential,
        credentialId: 'myCredentialId',
        credentialRevocationId: 'credentialRevocationId',
        linkSecretId: 'linkSecretId',
        issuerId: 'issuerDid',
        schemaIssuerId: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        methodName: 'inMemory',
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
      new AnonCredsCredentialRecord({
        credential: {
          cred_def_id: 'credDefId',
          schema_id: 'schemaId',
          signature: 'signature',
          signature_correctness_proof: 'signatureCorrectnessProof',
          values: { attr1: { raw: 'value1', encoded: 'encvalue1' }, attr2: { raw: 'value2', encoded: 'encvalue2' } },
          rev_reg_id: 'revRegId',
        } as AnonCredsCredential,
        credentialId: 'myCredentialId',
        credentialRevocationId: 'credentialRevocationId',
        linkSecretId: 'linkSecretId',
        issuerId: 'issuerDid',
        schemaIssuerId: 'schemaIssuerDid',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        methodName: 'inMemory',
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
      credentialDefinitionId: 'credDefId',
      schemaId: 'schemaId',
      schemaIssuerId: 'schemaIssuerDid',
      schemaName: 'schemaName',
      schemaVersion: 'schemaVersion',
      issuerId: 'issuerDid',
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
      issuerId: 'issuerId',
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
      schemaId: 'personschema:uri',
      credentialDefinitionId: 'personcreddef:uri',
      credentialDefinitionPrivate,
      keyCorrectnessProof,
      linkSecret,
      linkSecretId: 'linkSecretId',
      credentialId: 'personCredId',
      revocationRegistryDefinitionId: 'personrevregid:uri',
    })

    const saveCredentialMock = jest.spyOn(anoncredsCredentialRepositoryMock, 'save')

    saveCredentialMock.mockResolvedValue()

    const credentialId = await anonCredsHolderService.storeCredential(agentContext, {
      credential,
      credentialDefinition,
      schema,
      credentialDefinitionId: 'personcreddefid:uri',
      credentialRequestMetadata: credentialRequestMetadata.toJson() as unknown as AnonCredsCredentialRequestMetadata,
      credentialId: 'personCredId',
      revocationRegistry: {
        id: 'personrevregid:uri',
        definition: new RevocationRegistryDefinition(
          revocationRegistryDefinition.handle
        ).toJson() as unknown as AnonCredsRevocationRegistryDefinition,
      },
    })

    expect(credentialId).toBe('personCredId')
    expect(saveCredentialMock).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        // The stored credential is different from the one received originally
        credentialId: 'personCredId',
        linkSecretId: 'linkSecretId',
        _tags: expect.objectContaining({
          issuerId: credentialDefinition.issuerId,
          schemaName: 'schemaName',
          schemaIssuerId: 'issuerId',
          schemaVersion: '1',
        }),
      })
    )
  })
})
