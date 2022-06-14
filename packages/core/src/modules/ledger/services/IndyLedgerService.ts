import type { Logger } from '../../../logger'
import type { AcceptanceMechanisms, AuthorAgreement, IndyPool, TransactionAuthorAgreement } from '../IndyPool'
import type {
  default as Indy,
  CredDef,
  LedgerReadReplyResponse,
  LedgerRequest,
  LedgerWriteReplyResponse,
  NymRole,
  Schema,
} from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndySdkError } from '../../../error/IndySdkError'
import {
  didFromSchemaId,
  didFromCredentialDefinitionId,
  didFromRevocationRegistryDefinitionId,
} from '../../../utils/did'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'

import { IndyPoolService } from './IndyPoolService'

@scoped(Lifecycle.ContainerScoped)
export class IndyLedgerService {
  private wallet: IndyWallet
  private indy: typeof Indy
  private logger: Logger

  private indyIssuer: IndyIssuerService
  private indyPoolService: IndyPoolService

  public constructor(
    wallet: IndyWallet,
    agentConfig: AgentConfig,
    indyIssuer: IndyIssuerService,
    indyPoolService: IndyPoolService
  ) {
    this.wallet = wallet
    this.indy = agentConfig.agentDependencies.indy
    this.logger = agentConfig.logger
    this.indyIssuer = indyIssuer
    this.indyPoolService = indyPoolService
  }

  public async connectToPools() {
    return this.indyPoolService.connectToPools()
  }

  public async registerPublicDid(
    submitterDid: string,
    targetDid: string,
    verkey: string,
    alias: string,
    role?: NymRole,
    taa?: TransactionAuthorAgreement
  ) {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(`Register public did '${targetDid}' on ledger '${pool.id}'`)

      const request = await this.indy.buildNymRequest(submitterDid, targetDid, verkey, alias, role || null)

      const response = await this.submitWriteRequest(pool, request, submitterDid, taa)

      this.logger.debug(`Registered public did '${targetDid}' on ledger '${pool.id}'`, {
        response,
      })

      return targetDid
    } catch (error) {
      this.logger.error(`Error registering public did '${targetDid}' on ledger '${pool.id}'`, {
        error,
        submitterDid,
        targetDid,
        verkey,
        alias,
        role,
        pool,
      })

      throw error
    }
  }

  public async getPublicDid(did: string) {
    // Getting the pool for a did also retrieves the DID. We can just use that
    const { did: didResponse } = await this.indyPoolService.getPoolForDid(did)

    return didResponse
  }

  public async getEndpointsForDid(did: string) {
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    try {
      this.logger.debug(`Get endpoints for did '${did}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetAttribRequest(null, did, 'endpoint', null, null)

      this.logger.debug(`Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.id}'`)
      const response = await this.submitReadRequest(pool, request)

      if (!response.result.data) return {}

      const endpoints = JSON.parse(response.result.data as string)?.endpoint as IndyEndpointAttrib
      this.logger.debug(`Got endpoints '${JSON.stringify(endpoints)}' for did '${did}' from ledger '${pool.id}'`, {
        response,
        endpoints,
      })

      return endpoints ?? {}
    } catch (error) {
      this.logger.error(`Error retrieving endpoints for did '${did}' from ledger '${pool.id}'`, {
        error,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async registerSchema(
    did: string,
    schemaTemplate: SchemaTemplate,
    taa?: TransactionAuthorAgreement
  ): Promise<Schema> {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(`Register schema on ledger '${pool.id}' with did '${did}'`, schemaTemplate)
      const { name, attributes, version } = schemaTemplate
      const schema = await this.indyIssuer.createSchema({ originDid: did, name, version, attributes })

      const request = await this.indy.buildSchemaRequest(did, schema)

      const response = await this.submitWriteRequest(pool, request, did, taa)
      this.logger.debug(`Registered schema '${schema.id}' on ledger '${pool.id}'`, {
        response,
        schema,
      })

      schema.seqNo = response.result.txnMetadata.seqNo

      return schema
    } catch (error) {
      this.logger.error(`Error registering schema for did '${did}' on ledger '${pool.id}'`, {
        error,
        did,
        schemaTemplate,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getSchema(schemaId: string) {
    const did = didFromSchemaId(schemaId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    try {
      this.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetSchemaRequest(null, schemaId)

      this.logger.trace(`Submitting get schema request for schema '${schemaId}' to ledger '${pool.id}'`)
      const response = await this.submitReadRequest(pool, request)

      this.logger.trace(`Got un-parsed schema '${schemaId}' from ledger '${pool.id}'`, {
        response,
      })

      const [, schema] = await this.indy.parseGetSchemaResponse(response)
      this.logger.debug(`Got schema '${schemaId}' from ledger '${pool.id}'`, {
        schema,
      })

      return schema
    } catch (error) {
      this.logger.error(`Error retrieving schema '${schemaId}' from ledger '${pool.id}'`, {
        error,
        schemaId,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async registerCredentialDefinition(
    did: string,
    credentialDefinitionTemplate: CredentialDefinitionTemplate,
    taa?: TransactionAuthorAgreement
  ): Promise<CredDef> {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(
        `Registering credential definition on ledger '${pool.id}' with did '${did}'`,
        credentialDefinitionTemplate
      )
      const { schema, tag, signatureType, supportRevocation } = credentialDefinitionTemplate

      const credentialDefinition = await this.indyIssuer.createCredentialDefinition({
        issuerDid: did,
        schema,
        tag,
        signatureType,
        supportRevocation,
      })

      const request = await this.indy.buildCredDefRequest(did, credentialDefinition)

      const response = await this.submitWriteRequest(pool, request, did, taa)

      this.logger.debug(`Registered credential definition '${credentialDefinition.id}' on ledger '${pool.id}'`, {
        response,
        credentialDefinition: credentialDefinition,
      })

      return credentialDefinition
    } catch (error) {
      this.logger.error(
        `Error registering credential definition for schema '${credentialDefinitionTemplate.schema.id}' on ledger '${pool.id}'`,
        {
          error,
          did,
          credentialDefinitionTemplate,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getCredentialDefinition(credentialDefinitionId: string) {
    const did = didFromCredentialDefinitionId(credentialDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(`Using ledger '${pool.id}' to retrieve credential definition '${credentialDefinitionId}'`)

    try {
      const request = await this.indy.buildGetCredDefRequest(null, credentialDefinitionId)

      this.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger '${pool.id}'`
      )

      const response = await this.submitReadRequest(pool, request)
      this.logger.trace(`Got un-parsed credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        response,
      })

      const [, credentialDefinition] = await this.indy.parseGetCredDefResponse(response)
      this.logger.debug(`Got credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        credentialDefinition,
      })

      return credentialDefinition
    } catch (error) {
      this.logger.error(`Error retrieving credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        error,
        credentialDefinitionId,
        pool: pool.id,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate> {
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
    )
    try {
      //TODO - implement a cache
      this.logger.trace(
        `Revocation Registry Definition '${revocationRegistryDefinitionId}' not cached, retrieving from ledger`
      )

      const request = await this.indy.buildGetRevocRegDefRequest(null, revocationRegistryDefinitionId)

      this.logger.trace(
        `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await this.submitReadRequest(pool, request)
      this.logger.trace(
        `Got un-parsed revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.id}'`,
        {
          response,
        }
      )

      const [, revocationRegistryDefinition] = await this.indy.parseGetRevocRegDefResponse(response)

      this.logger.debug(`Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger`, {
        revocationRegistryDefinition,
      })

      return { revocationRegistryDefinition, revocationRegistryDefinitionTxnTime: response.result.txnTime }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId,
          pool: pool.id,
        }
      )
      throw error
    }
  }

  //Retrieves the accumulated state of a revocation registry by id given a revocation interval from & to (used primarily for proof creation)
  public async getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    to: number = new Date().getTime(),
    from = 0
  ): Promise<ParseRevocationRegistryDeltaTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry delta with revocation registry definition id: '${revocationRegistryDefinitionId}'`,
      {
        to,
        from,
      }
    )

    try {
      const request = await this.indy.buildGetRevocRegDeltaRequest(null, revocationRegistryDefinitionId, from, to)

      this.logger.trace(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )

      const response = await this.submitReadRequest(pool, request)
      this.logger.trace(
        `Got revocation registry delta unparsed-response '${revocationRegistryDefinitionId}' from ledger`,
        {
          response,
        }
      )

      const [, revocationRegistryDelta, deltaTimestamp] = await this.indy.parseGetRevocRegDeltaResponse(response)

      this.logger.debug(`Got revocation registry delta '${revocationRegistryDefinitionId}' from ledger`, {
        revocationRegistryDelta,
        deltaTimestamp,
        to,
        from,
      })

      return { revocationRegistryDelta, deltaTimestamp }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger, potentially revocation interval ends before revocation registry creation?"`,
        {
          error,
          revocationRegistryId: revocationRegistryDefinitionId,
          pool: pool.id,
        }
      )
      throw error
    }
  }

  //Retrieves the accumulated state of a revocation registry by id given a timestamp (used primarily for verification)
  public async getRevocationRegistry(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry accumulated state with revocation registry definition id: '${revocationRegistryDefinitionId}'`,
      {
        timestamp,
      }
    )

    try {
      const request = await this.indy.buildGetRevocRegRequest(null, revocationRegistryDefinitionId, timestamp)

      this.logger.trace(
        `Submitting get revocation registry request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await this.submitReadRequest(pool, request)
      this.logger.trace(
        `Got un-parsed revocation registry '${revocationRegistryDefinitionId}' from ledger '${pool.id}'`,
        {
          response,
        }
      )

      const [, revocationRegistry, ledgerTimestamp] = await this.indy.parseGetRevocRegResponse(response)
      this.logger.debug(`Got revocation registry '${revocationRegistryDefinitionId}' from ledger`, {
        ledgerTimestamp,
        revocationRegistry,
      })

      return { revocationRegistry, ledgerTimestamp }
    } catch (error) {
      this.logger.error(`Error retrieving revocation registry '${revocationRegistryDefinitionId}' from ledger`, {
        error,
        revocationRegistryId: revocationRegistryDefinitionId,
        pool: pool.id,
      })
      throw error
    }
  }

  private async submitWriteRequest(
    pool: IndyPool,
    request: LedgerRequest,
    signDid: string,
    taa?: TransactionAuthorAgreement
  ): Promise<LedgerWriteReplyResponse> {
    try {
      const requestWithTaa = await this.appendTaa(pool, request, taa)
      const signedRequestWithTaa = await this.signRequest(signDid, requestWithTaa)

      const response = await pool.submitWriteRequest(signedRequestWithTaa)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async submitReadRequest(pool: IndyPool, request: LedgerRequest): Promise<LedgerReadReplyResponse> {
    try {
      const response = await pool.submitReadRequest(request)

      return response
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async signRequest(did: string, request: LedgerRequest): Promise<LedgerRequest> {
    try {
      return this.indy.signRequest(this.wallet.handle, did, request)
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async appendTaa(pool: IndyPool, request: Indy.LedgerRequest, taa?: TransactionAuthorAgreement) {
    try {
      const authorAgreement = await this.getTransactionAuthorAgreement(pool)

      // If ledger does not have TAA, we can just send request
      if (authorAgreement == null) {
        return request
      }
      // Ledger has taa but user has not specified which one to use
      if (!taa) {
        throw new Error(
          `Please, specify a transaction author agreement with version and acceptance mechanism. ${JSON.stringify(
            authorAgreement
          )}`
        )
      }

      // Throw an error if the pool doesn't have the specified version and acceptance mechanism
      if (
        authorAgreement.acceptanceMechanisms.version !== taa.version ||
        !(taa.acceptanceMechanism in authorAgreement.acceptanceMechanisms.aml)
      ) {
        // Throw an error with a helpful message
        const errMessage = `Unable to satisfy matching TAA with mechanism ${JSON.stringify(
          taa.acceptanceMechanism
        )} and version ${JSON.stringify(taa.version)} in pool.\n Found ${JSON.stringify(
          authorAgreement.acceptanceMechanisms.aml
        )}`
        throw new Error(errMessage)
      }

      const requestWithTaa = await this.indy.appendTxnAuthorAgreementAcceptanceToRequest(
        request,
        authorAgreement.text,
        taa.version,
        authorAgreement.digest,
        taa.acceptanceMechanism,
        // Current time since epoch
        // We can't use ratification_ts, as it must be greater than 1499906902
        Math.floor(new Date().getTime() / 1000)
      )

      return requestWithTaa
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async getTransactionAuthorAgreement(pool: IndyPool): Promise<AuthorAgreement | null> {
    try {
      // TODO Replace this condition with memoization
      if (pool.authorAgreement !== undefined) {
        return pool.authorAgreement
      }

      const taaRequest = await this.indy.buildGetTxnAuthorAgreementRequest(null)
      const taaResponse = await this.submitReadRequest(pool, taaRequest)
      const acceptanceMechanismRequest = await this.indy.buildGetAcceptanceMechanismsRequest(null)
      const acceptanceMechanismResponse = await this.submitReadRequest(pool, acceptanceMechanismRequest)

      // TAA can be null
      if (taaResponse.result.data == null) {
        pool.authorAgreement = null
        return null
      }

      // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
      const authorAgreement = taaResponse.result.data as AuthorAgreement
      const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms
      pool.authorAgreement = {
        ...authorAgreement,
        acceptanceMechanisms,
      }
      return pool.authorAgreement
    } catch (error) {
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private getFirstAcceptanceMechanism(authorAgreement: AuthorAgreement) {
    const [firstMechanism] = Object.keys(authorAgreement.acceptanceMechanisms.aml)
    return firstMechanism
  }
}

export interface SchemaTemplate {
  name: string
  version: string
  attributes: string[]
}

export interface CredentialDefinitionTemplate {
  schema: Schema
  tag: string
  signatureType: 'CL'
  supportRevocation: boolean
}

export interface ParseRevocationRegistryDefinitionTemplate {
  revocationRegistryDefinition: Indy.RevocRegDef
  revocationRegistryDefinitionTxnTime: number
}

export interface ParseRevocationRegistryDeltaTemplate {
  revocationRegistryDelta: Indy.RevocRegDelta
  deltaTimestamp: number
}

export interface ParseRevocationRegistryTemplate {
  revocationRegistry: Indy.RevocReg
  ledgerTimestamp: number
}

export interface IndyEndpointAttrib {
  endpoint?: string
  types?: Array<'endpoint' | 'did-communication' | 'DIDComm'>
  routingKeys?: string[]
  [key: string]: unknown
}
