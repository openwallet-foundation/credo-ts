import type { Logger } from '../../../logger'
import type { AcceptanceMechanisms, AuthorAgreement, IndyPool } from '../IndyPool'
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

  private revocationRegistryDefinitions: { [poolId: string]: { [revRegId: string]: Indy.RevocRegDef } } = {}

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
    role?: NymRole
  ) {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(`Register public did '${targetDid}' on ledger '${pool.id}'`)

      const request = await this.indy.buildNymRequest(submitterDid, targetDid, verkey, alias, role || null)

      const response = await this.submitWriteRequest(pool, request, submitterDid)

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

  public async registerSchema(did: string, schemaTemplate: SchemaTemplate): Promise<Schema> {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(`Register schema on ledger '${pool.id}' with did '${did}'`, schemaTemplate)
      const { name, attributes, version } = schemaTemplate
      const schema = await this.indyIssuer.createSchema({ originDid: did, name, version, attributes })

      const request = await this.indy.buildSchemaRequest(did, schema)

      const response = await this.submitWriteRequest(pool, request, did)
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
      this.logger.debug(`Get schema '${schemaId}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetSchemaRequest(null, schemaId)

      this.logger.debug(`Submitting get schema request for schema '${schemaId}' to ledger '${pool.id}'`)
      const response = await this.submitReadRequest(pool, request)

      const [, schema] = await this.indy.parseGetSchemaResponse(response)
      this.logger.debug(`Got schema '${schemaId}' from ledger '${pool.id}'`, {
        response,
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
    credentialDefinitionTemplate: CredentialDefinitionTemplate
  ): Promise<CredDef> {
    const pool = this.indyPoolService.ledgerWritePool

    try {
      this.logger.debug(
        `Register credential definition on ledger '${pool.id}' with did '${did}'`,
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

      const response = await this.submitWriteRequest(pool, request, did)

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
      this.logger.debug(`Get credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetCredDefRequest(null, credentialDefinitionId)

      this.logger.debug(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger '${pool.id}'`
      )

      const response = await this.submitReadRequest(pool, request)

      const [, credentialDefinition] = await this.indy.parseGetCredDefResponse(response)
      this.logger.debug(`Got credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        response,
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

  public async getRevocationRegistryDefinition(revocationRegistryDefinitionId: string) {
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
    )
    try {
      //TODO: Add a persistant cache
      if (!this.revocationRegistryDefinitions[pool.id]?.[revocationRegistryDefinitionId]) {
        this.logger.trace(
          `Revocation Registry Definition '${revocationRegistryDefinitionId}' not cached, retrieving from ledger`
        )

        const request = await this.indy.buildGetRevocRegDefRequest(null, revocationRegistryDefinitionId)

        this.logger.debug(
          `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
        )
        const response = await this.submitReadRequest(pool, request)

        const [, revocRegDef] = await this.indy.parseGetRevocRegDefResponse(response)

        //TODO: REMOVE?
        // @ts-ignore
        revocRegDef.txnTime = response.result.txnTime

        this.logger.debug(`Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger`, {
          revocRegDef,
        })

        if (!this.revocationRegistryDefinitions[pool.id]) {
          this.revocationRegistryDefinitions[pool.id] = {}
        }
        this.revocationRegistryDefinitions[pool.id][revocationRegistryDefinitionId] = revocRegDef
      }

      return this.revocationRegistryDefinitions[pool.id][revocationRegistryDefinitionId]
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
  ): Promise<ParseRevRegDeltaTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry delta with revocation registry definition id: '${revocationRegistryDefinitionId}'`
    )

    try {
      const request = await this.indy.buildGetRevocRegDeltaRequest(null, revocationRegistryDefinitionId, from, to)

      this.logger.debug(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await this.submitReadRequest(pool, request)

      const [, revocRegDelta, deltaTimestamp] = await this.indy.parseGetRevocRegDeltaResponse(response)
      this.logger.debug(`Got revocation registry delta '${revocationRegistryDefinitionId}' from ledger`, {
        deltaTimestamp,
        revocRegDelta,
      })

      return { revocRegDelta, deltaTimestamp }
    } catch (error) {
      this.logger.error(`Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger`, {
        error,
        revocationRegistryId: revocationRegistryDefinitionId,
        pool: pool.id,
      })
      throw error
    }
  }

  //Retrieves the accumulated state of a revocation registry by id given a timestamp (used primarily for verification)
  public async getRevocationRegistry(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevRegTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.indyPoolService.getPoolForDid(did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry accumulated state with revocation registry definition id: '${revocationRegistryDefinitionId}'`
    )

    try {
      const request = await this.indy.buildGetRevocRegRequest(null, revocationRegistryDefinitionId, timestamp)

      this.logger.debug(
        `Submitting get revocation registry request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await this.submitReadRequest(pool, request)

      const [, revocReg, ledgerTimestamp] = await this.indy.parseGetRevocRegResponse(response)
      this.logger.debug(`Got revocation registry '${revocationRegistryDefinitionId}' from ledger`, {
        ledgerTimestamp,
        revocReg,
      })

      return { revocReg, ledgerTimestamp }
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
    signDid: string
  ): Promise<LedgerWriteReplyResponse> {
    try {
      const requestWithTaa = await this.appendTaa(pool, request)
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

  private async appendTaa(pool: IndyPool, request: Indy.LedgerRequest) {
    try {
      const authorAgreement = await this.getTransactionAuthorAgreement(pool)

      // If ledger does not have TAA, we can just send request
      if (authorAgreement == null) {
        return request
      }

      const requestWithTaa = await this.indy.appendTxnAuthorAgreementAcceptanceToRequest(
        request,
        authorAgreement.text,
        authorAgreement.version,
        authorAgreement.digest,
        this.getFirstAcceptanceMechanism(authorAgreement),
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

export interface ParseRevRegDeltaTemplate {
  revocRegDelta: Indy.RevocRegDelta
  deltaTimestamp: number
}

export interface ParseRevRegTemplate {
  revocReg: Indy.RevocReg
  ledgerTimestamp: number
}

export interface IndyEndpointAttrib {
  endpoint?: string
  types?: Array<'endpoint' | 'did-communication' | 'DIDComm'>
  routingKeys?: string[]
  [key: string]: unknown
}
