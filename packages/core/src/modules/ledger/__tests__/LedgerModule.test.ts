import type { IndyPoolConfig } from '../IndyPool'
import type { CredentialDefinitionTemplate } from '../services/IndyLedgerService'
import type * as Indy from 'indy-sdk'

import { getAgentConfig, mockFunction, mockProperty } from '../../../../tests/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { AnonCredsCredentialDefinitionRecord } from '../../indy/repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from '../../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from '../../indy/repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from '../../indy/repository/AnonCredsSchemaRepository'
import { LedgerModule } from '../LedgerModule'
import { IndyLedgerService } from '../services/IndyLedgerService'

jest.mock('../services/IndyLedgerService')
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>

jest.mock('../../indy/repository/AnonCredsCredentialDefinitionRepository')
const AnonCredsCredentialDefinitionRepositoryMock =
  AnonCredsCredentialDefinitionRepository as jest.Mock<AnonCredsCredentialDefinitionRepository>
jest.mock('../../indy/repository/AnonCredsSchemaRepository')
const AnonCredsSchemaRepositoryMock = AnonCredsSchemaRepository as jest.Mock<AnonCredsSchemaRepository>

const pools: IndyPoolConfig[] = [
  {
    id: 'sovrinMain',
    isProduction: true,
    genesisTransactions: 'xxx',
    transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
  },
]

const did = 'Y5bj4SjCiTM9PgeheKAiXx'

const schemaId = 'abcd'

const schema: Indy.Schema = {
  id: schemaId,
  attrNames: ['hello', 'world'],
  name: 'awesomeSchema',
  version: '1',
  ver: '1',
  seqNo: 99,
}

const credentialDefinition = {
  schema: 'abcde',
  tag: 'someTag',
  signatureType: 'CL',
  supportRevocation: true,
}

const credDef: Indy.CredDef = {
  id: 'abcde',
  schemaId: schema.id,
  type: 'CL',
  tag: 'someTag',
  value: {
    primary: credentialDefinition as Record<string, unknown>,
    revocation: true,
  },
  ver: '1',
}

const credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'> = {
  schema: schema,
  tag: 'someTag',
  supportRevocation: true,
}

describe('LedgerModule', () => {
  const config = getAgentConfig('LedgerModuleTest', {
    indyLedgers: pools,
  })
  let wallet: IndyWallet
  let ledgerService: IndyLedgerService
  let anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  let anonCredsSchemaRepository: AnonCredsSchemaRepository
  let ledgerModule: LedgerModule

  beforeEach(async () => {
    wallet = new IndyWallet(config)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(config.walletConfig!)
  })

  afterEach(async () => {
    await wallet.delete()
  })

  beforeEach(async () => {
    ledgerService = new IndyLedgerServiceMock()

    anonCredsCredentialDefinitionRepository = new AnonCredsCredentialDefinitionRepositoryMock()
    anonCredsSchemaRepository = new AnonCredsSchemaRepositoryMock()

    ledgerModule = new LedgerModule(
      wallet,
      ledgerService,
      anonCredsCredentialDefinitionRepository,
      anonCredsSchemaRepository
    )
  })

  describe('LedgerModule', () => {
    // Connect to pools
    describe('connectToPools', () => {
      it('should connect to all pools', async () => {
        mockFunction(ledgerService.connectToPools).mockResolvedValue([1, 2, 4])
        await expect(ledgerModule.connectToPools()).resolves
        expect(ledgerService.connectToPools).toHaveBeenCalled()
      })
    })

    // Register public did
    describe('registerPublicDid', () => {
      it('should register a public DID', async () => {
        mockFunction(ledgerService.registerPublicDid).mockResolvedValueOnce(did)
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        await expect(ledgerModule.registerPublicDid(did, 'abcde', 'someAlias')).resolves.toEqual(did)
        expect(ledgerService.registerPublicDid).toHaveBeenCalledWith(did, did, 'abcde', 'someAlias', undefined)
      })

      it('should throw an error if the DID cannot be registered because there is no public did', async () => {
        const did = 'Y5bj4SjCiTM9PgeheKAiXx'
        mockProperty(wallet, 'publicDid', undefined)
        await expect(ledgerModule.registerPublicDid(did, 'abcde', 'someAlias')).rejects.toThrowError(
          AriesFrameworkError
        )
      })
    })

    // Get public DID
    describe('getPublicDid', () => {
      it('should return the public DID if there is one', async () => {
        const nymResponse: Indy.GetNymResponse = { did: 'Y5bj4SjCiTM9PgeheKAiXx', verkey: 'abcde', role: 'STEWARD' }
        mockProperty(wallet, 'publicDid', { did: nymResponse.did, verkey: nymResponse.verkey })
        mockFunction(ledgerService.getPublicDid).mockResolvedValueOnce(nymResponse)
        await expect(ledgerModule.getPublicDid(nymResponse.did)).resolves.toEqual(nymResponse)
      })
    })

    // Get schema
    describe('getSchema', () => {
      it('should return the schema by id if there is one', async () => {
        mockFunction(ledgerService.getSchema).mockResolvedValueOnce(schema)
        await expect(ledgerModule.getSchema(schemaId)).resolves.toEqual(schema)
      })

      it('should throw an error if no schema for the id exists', async () => {
        mockFunction(ledgerService.getSchema).mockRejectedValueOnce(
          new AriesFrameworkError('Error retrieving schema abcd from ledger 1')
        )
        await expect(ledgerModule.getSchema(schemaId)).rejects.toThrowError(AriesFrameworkError)
      })
    })

    describe('registerSchema', () => {
      it('should throw an error if there is no public DID', async () => {
        mockProperty(wallet, 'publicDid', undefined)
        await expect(ledgerModule.registerSchema({ ...schema, attributes: ['hello', 'world'] })).rejects.toThrowError(
          AriesFrameworkError
        )
      })

      it('should return the schema from anonCreds when it already exists', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        mockFunction(anonCredsSchemaRepository.findBySchemaId).mockResolvedValueOnce(
          new AnonCredsSchemaRecord({ schema: schema })
        )
        await expect(ledgerModule.registerSchema({ ...schema, attributes: ['hello', 'world'] })).resolves.toEqual(
          schema
        )
      })

      it('should return the schema from the ledger when it already exists', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(LedgerModule.prototype as any, 'findBySchemaIdOnLedger')
          .mockResolvedValueOnce(new AnonCredsSchemaRecord({ schema: schema }))
        await expect(
          ledgerModule.registerSchema({ ...schema, attributes: ['hello', 'world'] })
        ).resolves.toHaveProperty('schema', schema)
      })

      it('should return the schema after registering it', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        mockFunction(ledgerService.registerSchema).mockResolvedValueOnce(schema)
        await expect(ledgerModule.registerSchema({ ...schema, attributes: ['hello', 'world'] })).resolves.toEqual(
          schema
        )
      })
    })

    describe('registerCredentialDefinition', () => {
      it('should throw an error if there si no public DID', async () => {
        mockProperty(wallet, 'publicDid', undefined)
        await expect(ledgerModule.registerCredentialDefinition(credentialDefinitionTemplate)).rejects.toThrowError(
          AriesFrameworkError
        )
      })

      it('should return the credential definition from the wallet if it already exists', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        const anonCredsCredentialDefinitionRecord: AnonCredsCredentialDefinitionRecord =
          new AnonCredsCredentialDefinitionRecord({
            credentialDefinition: credDef,
          })
        mockFunction(anonCredsCredentialDefinitionRepository.findByCredentialDefinitionId).mockResolvedValueOnce(
          anonCredsCredentialDefinitionRecord
        )
        await expect(ledgerModule.registerCredentialDefinition(credentialDefinitionTemplate)).resolves.toHaveProperty(
          'value.primary',
          credentialDefinition
        )
      })

      it('should throw an exception if the definition already exists on the ledger', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        jest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .spyOn(LedgerModule.prototype as any, 'findByCredentialDefinitionIdOnLedger')
          .mockResolvedValueOnce({ credentialDefinition: credentialDefinition })
        await expect(ledgerModule.registerCredentialDefinition(credentialDefinitionTemplate)).rejects.toThrowError(
          AriesFrameworkError
        )
      })

      it('should register the credential successfully if it is neither in the wallet and neither on the ledger', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        mockFunction(ledgerService.registerCredentialDefinition).mockResolvedValueOnce(credDef)
        await expect(ledgerModule.registerCredentialDefinition(credentialDefinitionTemplate)).resolves.toEqual(credDef)
      })
    })

    describe('getCredentialDefinition', () => {
      it('should return the credential definition given the id', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        mockFunction(ledgerService.getCredentialDefinition).mockResolvedValue(credDef)
        await expect(ledgerModule.getCredentialDefinition(credDef.id)).resolves.toEqual(credDef)
      })

      it('should throw an error if there is no credential definition for the given id', async () => {
        mockProperty(wallet, 'publicDid', { did: did, verkey: 'abcde' })
        mockFunction(ledgerService.getCredentialDefinition).mockRejectedValueOnce(new AriesFrameworkError(''))
        await expect(ledgerModule.getCredentialDefinition(credDef.id)).rejects.toThrowError(AriesFrameworkError)
      })
    })

    describe('getRevocationRegistryDefinition', () => {
      it('should return the ParseRevocationRegistryDefinitionTemplate for a valid revocationRegistryDefinitionId', async () => {
        const revocRegDef: Indy.RevocRegDef = {
          id: 'abcde',
          revocDefType: 'CL_ACCUM',
          tag: 'someTag',
          credDefId: 'abcde',
          value: {
            issuanceType: 'ISSUANCE_BY_DEFAULT',
            maxCredNum: 3,
            tailsHash: 'abcde',
            tailsLocation: 'xyz',
            publicKeys: ['abcde', 'fghijk'],
          },
          ver: 'abcde',
        }
        const parseRevocationRegistryDefinitionTemplate = {
          revocationRegistryDefinition: revocRegDef,
          revocationRegistryDefinitionTxnTime: 12345678,
        }
        mockFunction(ledgerService.getRevocationRegistryDefinition).mockResolvedValue(
          parseRevocationRegistryDefinitionTemplate
        )
        await expect(ledgerModule.getRevocationRegistryDefinition(revocRegDef.id)).resolves.toBe(
          parseRevocationRegistryDefinitionTemplate
        )
      })

      it('should throw an error if the ParseRevocationRegistryDefinitionTemplate does not exists', async () => {
        mockFunction(ledgerService.getRevocationRegistryDefinition).mockRejectedValueOnce(new AriesFrameworkError(''))
        await expect(ledgerModule.getRevocationRegistryDefinition('abcde')).rejects.toThrowError(AriesFrameworkError)
      })
    })

    describe('getRevocationRegistryDelta', () => {
      it('should return the ParseRevocationRegistryDeltaTemplate', async () => {
        const revocRegDelta = {
          value: {
            prevAccum: 'prev',
            accum: 'accum',
            issued: [1, 2, 3],
            revoked: [4, 5, 6],
          },
          ver: 'ver',
        }
        const parseRevocationRegistryDeltaTemplate = {
          revocationRegistryDelta: revocRegDelta,
          deltaTimestamp: 12345678,
        }

        mockFunction(ledgerService.getRevocationRegistryDelta).mockResolvedValueOnce(
          parseRevocationRegistryDeltaTemplate
        )
        await expect(ledgerModule.getRevocationRegistryDelta('12345')).resolves.toEqual(
          parseRevocationRegistryDeltaTemplate
        )
      })

      it('should throw an error if the delta cannot be obtained', async () => {
        mockFunction(ledgerService.getRevocationRegistryDelta).mockRejectedValueOnce(new AriesFrameworkError(''))
        await expect(ledgerModule.getRevocationRegistryDelta('abde1234')).rejects.toThrowError(AriesFrameworkError)
      })
    })
  })
})
