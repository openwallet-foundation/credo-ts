import { parseIndyDid } from '@credo-ts/anoncreds'
import type {
  AgentContext,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidDocument,
  DidDocumentKey,
  DidDocumentService,
  DidOperationStateActionBase,
  DidRegistrar,
  DidUpdateResult,
} from '@credo-ts/core'
import {
  CredoError,
  DidCommV1Service,
  DidCommV2Service,
  DidDocumentRole,
  DidRecord,
  DidRepository,
  Hasher,
  IndyAgentService,
  Kms,
  NewDidCommV2Service,
  TypedArrayEncoder,
} from '@credo-ts/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'
import { AttribRequest, CustomRequest, NymRequest } from '@hyperledger/indy-vdr-shared'
import { IndyVdrError } from '../error'
import type { IndyVdrPool } from '../pool'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'
import {
  createKeyAgreementKey,
  didDocDiff,
  indyDidDocumentFromDid,
  verificationPublicJwkForIndyDid,
} from './didIndyUtil'
import type { IndyEndpointAttrib } from './didSovUtil'
import { endpointsAttribFromServices } from './didSovUtil'

export class IndyVdrIndyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']

  private didCreateActionResult({
    namespace,
    didAction,
    did,
  }: {
    namespace: string
    didAction: EndorseDidTxAction
    did: string
  }): IndyVdrDidCreateResult {
    return {
      jobId: did,
      didDocumentMetadata: {},
      didRegistrationMetadata: {
        didIndyNamespace: namespace,
      },
      didState: didAction,
    }
  }

  private didCreateFailedResult({ reason }: { reason: string }): IndyVdrDidCreateResult {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: reason,
      },
    }
  }

  private didCreateFinishedResult({
    did,
    didDocument,
    namespace,
  }: {
    did: string
    didDocument: DidDocument
    namespace: string
  }): IndyVdrDidCreateResult {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {
        didIndyNamespace: namespace,
      },
      didState: {
        state: 'finished',
        did,
        didDocument,
      },
    }
  }

  public async parseInput(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<ParseInputResult> {
    if (options.options.endorsedTransaction) {
      if (!options.did || typeof options.did !== 'string') {
        return {
          status: 'error',
          reason: 'If endorsedTransaction is provided, a DID must also be provided',
        }
      }
      const { namespace, namespaceIdentifier } = parseIndyDid(options.did)
      // endorser did from the transaction
      const endorserNamespaceIdentifier = JSON.parse(options.options.endorsedTransaction.nymRequest).identifier

      return {
        status: 'ok',
        type: 'endorsedTransaction',
        endorsedTransaction: options.options.endorsedTransaction,
        did: options.did,
        namespace,
        namespaceIdentifier,
        endorserNamespaceIdentifier,
      }
    }

    const endorserDid = options.options.endorserDid
    const { namespace: endorserNamespace, namespaceIdentifier: endorserNamespaceIdentifier } = parseIndyDid(endorserDid)

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const _verificationKey = options.options.keyId
      ? await kms.getPublicKey({ keyId: options.options.keyId })
      : (
          await kms.createKey({
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          })
        ).publicJwk

    if (_verificationKey.kty !== 'OKP' || _verificationKey.crv !== 'Ed25519') {
      return {
        status: 'error',
        reason: `keyId must point to an Ed25519 key, but found ${Kms.getJwkHumanDescription(_verificationKey)}`,
      }
    }

    const verificationKey = Kms.PublicJwk.fromPublicJwk(_verificationKey) as Kms.PublicJwk<Kms.Ed25519PublicJwk>

    // Create a new key and calculate did according to the rules for indy did method
    const buffer = Hasher.hash(verificationKey.publicKey.publicKey, 'sha-256')

    const namespaceIdentifier = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
    const did = `did:indy:${endorserNamespace}:${namespaceIdentifier}`

    return {
      status: 'ok',
      type: 'create',
      did,
      verificationKey,
      endorserDid: options.options.endorserDid,
      alias: options.options.alias,
      role: options.options.role,
      services: options.options.services,
      useEndpointAttrib: options.options.useEndpointAttrib,
      namespaceIdentifier,
      namespace: endorserNamespace,
      endorserNamespaceIdentifier,
    }
  }

  public async saveDidRecord(
    agentContext: AgentContext,
    did: string,
    didDocument: DidDocument,
    keys: DidDocumentKey[]
  ): Promise<void> {
    // Save the did so we know we created it and can issue with it
    const didRecord = new DidRecord({
      did,
      role: DidDocumentRole.Created,
      didDocument,
      keys,
    })

    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    await didRepository.save(agentContext, didRecord)
  }

  public async getDidDocumentFromRecord(agentContext: AgentContext, did: string): Promise<DidDocument> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const didRecord = await didRepository.getSingleByQuery(agentContext, {
      did,
      role: DidDocumentRole.Created,
    })

    if (!didRecord.didDocument) {
      throw new CredoError(`Did record for did '${did}' has no did document.`)
    }

    return didRecord.didDocument
  }

  private createDidDocument(
    did: string,
    verificationKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>,
    services: DidDocumentService[] | undefined,
    useEndpointAttrib: boolean | undefined
  ) {
    const verificationKeyBase58 = TypedArrayEncoder.toBase58(verificationKey.publicKey.publicKey)
    // Create base did document
    const didDocumentBuilder = indyDidDocumentFromDid(did, verificationKeyBase58)
    let diddocContent: Record<string, unknown> | undefined

    // Add services if object was passed
    if (services) {
      for (const item of services) {
        const prependDidIfNotPresent = (id: string) => {
          return id.startsWith('#') ? `${did}${id}` : id
        }

        // Prepend the did to the service id if it is not already there
        item.id = prependDidIfNotPresent(item.id)

        // TODO: should we also prepend the did to routingKeys?
        if (item instanceof DidCommV1Service) {
          item.recipientKeys = item.recipientKeys.map(prependDidIfNotPresent)
        }

        didDocumentBuilder.addService(item)
      }

      const commTypes = [IndyAgentService.type, DidCommV1Service.type, NewDidCommV2Service.type, DidCommV2Service.type]
      const serviceTypes = new Set(services.map((item) => item.type))

      const keyAgreementId = `${did}#key-agreement-1`

      // If there is at least a communication service, add the key agreement key
      if (commTypes.some((type) => serviceTypes.has(type))) {
        didDocumentBuilder
          .addContext('https://w3id.org/security/suites/x25519-2019/v1')
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(verificationKeyBase58),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)
      }

      // FIXME: it doesn't seem this context exists?
      // If there is a DIDComm V2 service, add context
      if (serviceTypes.has(NewDidCommV2Service.type) || serviceTypes.has(DidCommV2Service.type)) {
        didDocumentBuilder.addContext('https://didcomm.org/messaging/contexts/v2')
      }

      if (!useEndpointAttrib) {
        // create diddocContent parameter based on the diff between the base and the resulting DID Document
        diddocContent = didDocDiff(
          didDocumentBuilder.build().toJSON(),
          indyDidDocumentFromDid(did, verificationKeyBase58).build().toJSON()
        )
      }
    }

    // Build did document
    const didDocument = didDocumentBuilder.build()

    return {
      diddocContent,
      didDocument,
    }
  }

  // FIXME: we need to completely revamp this logic, it's overly complex
  // We might even want to look at ditching the whole generic DIDs api ...
  public async create(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<IndyVdrDidCreateResult> {
    try {
      const res = await this.parseInput(agentContext, options)
      if (res.status === 'error') return this.didCreateFailedResult({ reason: res.reason })

      const did = res.did

      const pool = agentContext.dependencyManager.resolve(IndyVdrPoolService).getPoolForNamespace(res.namespace)

      let nymRequest: NymRequest | CustomRequest
      let didDocument: DidDocument | undefined
      let attribRequest: AttribRequest | CustomRequest | undefined
      let verificationKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> | undefined

      if (res.type === 'endorsedTransaction') {
        const { nymRequest: _nymRequest, attribRequest: _attribRequest } = res.endorsedTransaction
        nymRequest = new CustomRequest({ customRequest: _nymRequest })
        attribRequest = _attribRequest ? new CustomRequest({ customRequest: _attribRequest }) : undefined
      } else {
        const {
          services,
          useEndpointAttrib,
          alias,
          endorserNamespaceIdentifier,
          namespaceIdentifier,
          did,
          role,
          endorserDid,
          namespace,
        } = res
        verificationKey = res.verificationKey

        const { didDocument: _didDocument, diddocContent } = this.createDidDocument(
          did,
          verificationKey,
          services,
          useEndpointAttrib
        )
        didDocument = _didDocument

        const didRegisterSigningKey =
          options.options.endorserMode === 'internal'
            ? await verificationPublicJwkForIndyDid(agentContext, options.options.endorserDid)
            : undefined

        nymRequest = await this.createRegisterDidWriteRequest({
          agentContext,
          pool,
          signingKey: didRegisterSigningKey,
          submitterNamespaceIdentifier: endorserNamespaceIdentifier,
          namespaceIdentifier,
          verificationKey,
          alias,
          diddocContent,
          role,
        })

        if (services && useEndpointAttrib) {
          const endpoints = endpointsAttribFromServices(services)
          attribRequest = await this.createSetDidEndpointsRequest({
            agentContext,
            pool,
            signingKey: verificationKey,
            endorserDid: options.options.endorserMode === 'external' ? endorserDid : undefined,
            unqualifiedDid: namespaceIdentifier,
            endpoints,
          })
        }

        if (options.options.endorserMode === 'external') {
          // We already save the did record, including the link between kms key id and did key id
          await this.saveDidRecord(agentContext, did, didDocument, [
            {
              didDocumentRelativeKeyId: '#verkey',
              kmsKeyId: verificationKey.keyId,
            },
          ])
          const didAction: EndorseDidTxAction = {
            state: 'action',
            action: 'endorseIndyTransaction',
            endorserDid: endorserDid,
            nymRequest: nymRequest.body,
            attribRequest: attribRequest?.body,
            did: did,
          }

          return this.didCreateActionResult({ namespace, didAction, did })
        }
      }

      await this.registerPublicDid(agentContext, pool, nymRequest)
      if (attribRequest) await this.setEndpointsForDid(agentContext, pool, attribRequest)

      // DID Document is undefined if this method is called based on external endorsement
      // but in that case the did document is already saved
      if (verificationKey && didDocument) {
        await this.saveDidRecord(agentContext, did, didDocument, [
          {
            didDocumentRelativeKeyId: '#verkey',
            kmsKeyId: verificationKey.keyId,
          },
        ])
      }

      didDocument = didDocument ?? (await this.getDidDocumentFromRecord(agentContext, did))
      return this.didCreateFinishedResult({ did, didDocument, namespace: res.namespace })
    } catch (error) {
      agentContext.config.logger.error('Error creating indy did', {
        error,
      })
      return this.didCreateFailedResult({
        reason: `unknownError: ${error.message}`,
      })
    }
  }

  public async update(): Promise<DidUpdateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: updating did:indy not implemented yet',
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: deactivating did:indy not implemented yet',
      },
    }
  }

  private async createRegisterDidWriteRequest(options: {
    agentContext: AgentContext
    pool: IndyVdrPool
    submitterNamespaceIdentifier: string
    namespaceIdentifier: string
    verificationKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
    signingKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
    alias: string | undefined
    diddocContent?: Record<string, unknown>
    role?: NymRequestRole
  }) {
    const {
      agentContext,
      pool,
      submitterNamespaceIdentifier,
      namespaceIdentifier,
      verificationKey,
      alias,
      signingKey,
      role,
    } = options

    // FIXME: Add diddocContent when supported by indy-vdr
    if (options.diddocContent) {
      throw new IndyVdrError('diddocContent is not yet supported')
    }

    const request = new NymRequest({
      submitterDid: submitterNamespaceIdentifier,
      dest: namespaceIdentifier,
      verkey: TypedArrayEncoder.toBase58(verificationKey.publicKey.publicKey),
      alias,
      role,
    })

    if (!signingKey) return request
    const writeRequest = await pool.prepareWriteRequest(agentContext, request, signingKey, undefined)
    return writeRequest
  }

  private async registerPublicDid<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    writeRequest: Request
  ) {
    const body = writeRequest.body
    try {
      const response = await pool.submitRequest(writeRequest)

      agentContext.config.logger.debug(`Register public did on ledger '${pool.indyNamespace}'\nRequest: ${body}}`, {
        response,
      })

      return
    } catch (error) {
      agentContext.config.logger.error(
        `Error Registering public did on ledger '${pool.indyNamespace}'\nRequest: ${body}}`
      )

      throw error
    }
  }

  private async createSetDidEndpointsRequest(options: {
    agentContext: AgentContext
    pool: IndyVdrPool
    signingKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
    endorserDid?: string
    unqualifiedDid: string
    endpoints: IndyEndpointAttrib
  }): Promise<AttribRequest> {
    const { agentContext, pool, endpoints, unqualifiedDid, signingKey, endorserDid } = options
    const request = new AttribRequest({
      submitterDid: unqualifiedDid,
      targetDid: unqualifiedDid,
      raw: JSON.stringify({ endpoint: endpoints }),
    })

    const writeRequest = await pool.prepareWriteRequest(agentContext, request, signingKey, endorserDid)
    return writeRequest
  }

  private async setEndpointsForDid<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    writeRequest: Request
  ): Promise<void> {
    const body = writeRequest.body
    try {
      const response = await pool.submitRequest(writeRequest)

      agentContext.config.logger.debug(
        `Successfully set endpoints for did on ledger '${pool.indyNamespace}'.\nRequest: ${body}}`,
        {
          response,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error setting endpoints for did on ledger '${pool.indyNamespace}'.\nRequest: ${body}}`
      )

      throw new IndyVdrError(error)
    }
  }
}

interface IndyVdrDidCreateOptionsWithoutDid extends DidCreateOptions {
  didDocument?: never // Not yet supported
  did?: never
  method: 'indy'
  options: {
    /**
     * Optionally an existing keyId can be provided, in this case the did will be created
     * based on the existing key
     */
    keyId?: string

    alias?: string
    role?: NymRequestRole
    services?: DidDocumentService[]
    useEndpointAttrib?: boolean

    // endorserDid is always required. We just have internal or external mode
    endorserDid: string
    // if endorserMode is 'internal', the endorserDid MUST be present in the wallet
    // if endorserMode is 'external', the endorserDid doesn't have to be present in the wallet
    endorserMode: 'internal' | 'external'
    endorsedTransaction?: never
  }
}

// When transactions have been endorsed. Only supported for external mode
// this is a separate interface so we can remove all the properties we don't need anymore.
interface IndyVdrDidCreateOptionsForSubmission extends DidCreateOptions {
  didDocument?: never
  did: string // for submission MUST always have a did, so we know which did we're submitting the transaction for. We MUST check whether the did passed here, matches with the
  method?: never
  options: {
    endorserMode: 'external'

    // provide the endorsed transactions. If these are provided
    // we will submit the transactions to the ledger
    endorsedTransaction: {
      nymRequest: string
      attribRequest?: string
    }
  }
}

export type IndyVdrDidCreateOptions = IndyVdrDidCreateOptionsWithoutDid | IndyVdrDidCreateOptionsForSubmission

type ParseInputOkEndorsedTransaction = {
  status: 'ok'
  did: string
  type: 'endorsedTransaction'
  endorsedTransaction: IndyVdrDidCreateOptionsForSubmission['options']['endorsedTransaction']
  namespaceIdentifier: string
  namespace: string
  endorserNamespaceIdentifier: string
}

type ParseInputOkCreate = {
  status: 'ok'
  type: 'create'
  did: string
  verificationKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  namespaceIdentifier: string
  namespace: string
  endorserNamespaceIdentifier: string
  endorserDid: string
  alias?: string
  role?: NymRequestRole
  services?: DidDocumentService[]
  useEndpointAttrib?: boolean
}

type parseInputError = { status: 'error'; reason: string }

type ParseInputResult = ParseInputOkEndorsedTransaction | ParseInputOkCreate | parseInputError

export interface EndorseDidTxAction extends DidOperationStateActionBase {
  action: 'endorseIndyTransaction'
  endorserDid: string
  nymRequest: string
  attribRequest?: string
  did: string
}

export type IndyVdrDidCreateResult = DidCreateResult<EndorseDidTxAction>

export type NymRequestRole = 'STEWARD' | 'TRUSTEE' | 'ENDORSER' | 'NETWORK_MONITOR'
