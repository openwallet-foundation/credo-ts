import type Indy from 'indy-sdk'
import type {
  CredDef,
  CredDefId,
  Did,
  LedgerRequest,
  PoolConfig,
  PoolHandle,
  Schema,
  SchemaId,
  LedgerReadReplyResponse,
  LedgerWriteReplyResponse,
} from 'indy-sdk'
import { AgentConfig } from '../../../agent/AgentConfig'
import { Logger } from '../../../logger'
import { isIndyError } from '../../../utils/indyError'
import { Wallet } from '../../../wallet/Wallet'

export class LedgerService {
  private wallet: Wallet
  private indy: typeof Indy
  private logger: Logger
  private _poolHandle?: PoolHandle
  private authorAgreement?: AuthorAgreement | null

  public constructor(wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.indy = agentConfig.indy
    this.logger = agentConfig.logger
  }

  private get poolHandle() {
    if (!this._poolHandle) {
      throw new Error('Pool has not been initialized yet.')
    }

    return this._poolHandle
  }

  public async connect(poolName: string, poolConfig: PoolConfig) {
    this.logger.debug(`Connecting to ledger pool '${poolName}'`, poolConfig)
    try {
      this.logger.debug(`Creating pool '${poolName}'`)
      await this.indy.createPoolLedgerConfig(poolName, poolConfig)
    } catch (error) {
      if (isIndyError(error, 'PoolLedgerConfigAlreadyExistsError')) {
        this.logger.debug(`Pool '${poolName}' already exists`, {
          indyError: 'PoolLedgerConfigAlreadyExistsError',
        })
      } else {
        throw error
      }
    }

    this.logger.debug('Setting ledger protocol version to 2')
    await this.indy.setProtocolVersion(2)

    this.logger.debug(`Opening pool ${poolName}`)
    this._poolHandle = await this.indy.openPoolLedger(poolName)
  }

  public async getPublicDid(did: Did) {
    this.logger.debug(`Get public did '${did}' from ledger`)
    const request = await this.indy.buildGetNymRequest(null, did)

    this.logger.debug(`Submitting get did request for did '${did}' to ledger`)
    const response = await this.indy.submitRequest(this.poolHandle, request)

    const result = await this.indy.parseGetNymResponse(response)
    this.logger.debug(`Retrieved did '${did}' from ledger`, result)

    return result
  }

  public async registerSchema(did: Did, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
    try {
      this.logger.debug(`Register schema on ledger with did '${did}'`, schemaTemplate)
      const { name, attributes, version } = schemaTemplate
      const [schemaId, schema] = await this.indy.issuerCreateSchema(did, name, version, attributes)

      const request = await this.indy.buildSchemaRequest(did, schema)

      const response = await this.submitWriteRequest(request, did)
      this.logger.debug(`Registered schema '${schemaId}' on ledger`, {
        response,
        schema,
      })

      schema.seqNo = response.result.txnMetadata.seqNo

      return [schemaId, schema]
    } catch (error) {
      this.logger.error(`Error registering schema for did '${did}' on ledger`, {
        error,
        did,
        poolHandle: this.poolHandle,
        schemaTemplate,
      })

      throw error
    }
  }

  public async getSchema(schemaId: SchemaId) {
    try {
      this.logger.debug(`Get schema '${schemaId}' from ledger`)

      const request = await this.indy.buildGetSchemaRequest(null, schemaId)

      this.logger.debug(`Submitting get schema request for schema '${schemaId}' to ledger`)
      const response = await this.submitReadRequest(request)

      const [, schema] = await this.indy.parseGetSchemaResponse(response)
      this.logger.debug(`Got schema '${schemaId}' from ledger`, {
        response,
        schema,
      })

      return schema
    } catch (error) {
      this.logger.error(`Error retrieving schema '${schemaId}' from ledger`, {
        error,
        schemaId,
        poolHandle: this.poolHandle,
      })

      throw error
    }
  }

  public async registerCredentialDefinition(
    did: Did,
    credentialDefinitionTemplate: CredDefTemplate
  ): Promise<[CredDefId, CredDef]> {
    try {
      this.logger.debug(`Register credential definition on ledger with did '${did}'`, credentialDefinitionTemplate)
      const { schema, tag, signatureType, config } = credentialDefinitionTemplate

      const [credDefId, credDef] = await this.wallet.createCredentialDefinition(did, schema, tag, signatureType, {
        support_revocation: config.supportRevocation,
      })

      const request = await this.indy.buildCredDefRequest(did, credDef)

      const response = await this.submitWriteRequest(request, did)

      this.logger.debug(`Registered credential definition '${credDefId}' on ledger`, {
        response,
        credentialDefinition: credDef,
      })

      return [credDefId, credDef]
    } catch (error) {
      this.logger.error(
        `Error registering credential definition for schema '${credentialDefinitionTemplate.schema.id}' on ledger`,
        {
          error,
          did,
          poolHandle: this.poolHandle,
          credentialDefinitionTemplate,
        }
      )

      throw error
    }
  }

  public async getCredentialDefinition(credentialDefinitionId: CredDefId) {
    try {
      this.logger.debug(`Get credential definition '${credentialDefinitionId}' from ledger`)

      const request = await this.indy.buildGetCredDefRequest(null, credentialDefinitionId)

      this.logger.debug(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger`
      )
      const response = await this.submitReadRequest(request)

      const [, credentialDefinition] = await this.indy.parseGetCredDefResponse(response)
      this.logger.debug(`Got credential definition '${credentialDefinitionId}' from ledger`, {
        response,
        credentialDefinition,
      })

      return credentialDefinition
    } catch (error) {
      this.logger.error(`Error retrieving credential definition '${credentialDefinitionId}' from ledger`, {
        error,
        credentialDefinitionId: credentialDefinitionId,
        poolHandle: this.poolHandle,
      })
      throw error
    }
  }

  private async submitWriteRequest(request: LedgerRequest, signDid: string): Promise<LedgerWriteReplyResponse> {
    const requestWithTaa = await this.appendTaa(request)
    const signedRequestWithTaa = await this.wallet.signRequest(signDid, requestWithTaa)

    const response = await this.indy.submitRequest(this.poolHandle, signedRequestWithTaa)

    if (response.op === 'REJECT') {
      throw Error(`Ledger rejected transaction request: ${response.reason}`)
    }

    return response as LedgerWriteReplyResponse
  }

  private async submitReadRequest(request: LedgerRequest): Promise<LedgerReadReplyResponse> {
    const response = await this.indy.submitRequest(this.poolHandle, request)

    if (response.op === 'REJECT') {
      throw Error(`Ledger rejected transaction request: ${response.reason}`)
    }

    return response as LedgerReadReplyResponse
  }

  private async appendTaa(request: LedgerRequest) {
    const authorAgreement = await this.getTransactionAuthorAgreement()

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
  }

  private async getTransactionAuthorAgreement(): Promise<AuthorAgreement | null> {
    // TODO Replace this condition with memoization
    if (this.authorAgreement !== undefined) {
      return this.authorAgreement
    }

    const taaRequest = await this.indy.buildGetTxnAuthorAgreementRequest(null)
    const taaResponse = await this.submitReadRequest(taaRequest)
    const acceptanceMechanismRequest = await this.indy.buildGetAcceptanceMechanismsRequest(null)
    const acceptanceMechanismResponse = await this.submitReadRequest(acceptanceMechanismRequest)

    // TAA can be null
    if (taaResponse.result.data == null) {
      this.authorAgreement = null
      return null
    }

    // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
    const authorAgreement = taaResponse.result.data as AuthorAgreement
    const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms
    this.authorAgreement = {
      ...authorAgreement,
      acceptanceMechanisms,
    }
    return this.authorAgreement
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

export interface CredDefTemplate {
  schema: Schema
  tag: string
  signatureType: string
  config: { supportRevocation: boolean }
}

interface AuthorAgreement {
  digest: string
  version: string
  text: string
  ratification_ts: number
  acceptanceMechanisms: AcceptanceMechanisms
}

interface AcceptanceMechanisms {
  aml: Record<string, string>
  amlContext: string
  version: string
}
