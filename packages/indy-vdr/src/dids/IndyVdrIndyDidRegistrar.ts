import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndyVdrPool } from '../pool'
import type {
  AgentContext,
  Buffer,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidDocument,
  DidDocumentService,
  DidOperationStateActionBase,
  DidRegistrar,
  DidUpdateResult,
} from '@aries-framework/core'
import type { CustomRequest, IndyVdrRequest } from '@hyperledger/indy-vdr-shared'

import {
  DidCommV1Service,
  DidCommV2Service,
  DidDocumentRole,
  DidRecord,
  DidRepository,
  Hasher,
  IndyAgentService,
  Key,
  KeyType,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { AttribRequest, NymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'

import {
  createKeyAgreementKey,
  didDocDiff,
  indyDidDocumentFromDid,
  isSelfCertifiedIndyDid,
  parseIndyDid,
  verificationKeyForIndyDid,
} from './didIndyUtil'
import { endpointsAttribFromServices } from './didSovUtil'

export class IndyVdrIndyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']

  private didCreateActionResult({
    namespace,
    didAction,
    jobId,
  }: {
    namespace: string
    didAction: EndorseDidTxAction
    jobId: string
  }): IndyVdrDidCreateResult {
    return {
      jobId: jobId,
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
    seed,
    privateKey,
    did,
    didDocument,
    namespace,
  }: {
    seed: Buffer | undefined
    privateKey: Buffer | undefined
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
        secret: {
          // FIXME: the uni-registrar creates the seed in the registrar method
          // if it doesn't exist so the seed can always be returned. Currently
          // we can only return it if the seed was passed in by the user. Once
          // we have a secure method for generating seeds we should use the same
          // approach
          seed: seed,
          privateKey: privateKey,
        },
      },
    }
  }

  public async parseInput(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<ParseInputResult> {
    let did = options.did
    let namespaceIdentifier: string
    let verificationKey: Key
    const seed = options.secret?.seed
    const privateKey = options.secret?.privateKey
    const didCreateMode = options.options.mode

    let submitterDid: string

    if (didCreateMode.type === 'toBeEndorsed') submitterDid = didCreateMode.endorserDid
    else if (didCreateMode.type === 'submit') submitterDid = didCreateMode.endorseDidTxAction.endorserDid
    else submitterDid = didCreateMode.submitterDid

    const { namespace: submitterNamespace, namespaceIdentifier: submitterNamespaceIdentifier } =
      parseIndyDid(submitterDid)

    if (didCreateMode.type === 'submit') {
      const did = JSON.parse(didCreateMode.endorseDidTxAction.nymRequest.body).operation.dest
      return {
        status: 'ok',
        did: `did:indy:${submitterNamespace}:${did}`,
        namespaceIdentifier: did,
        namespace: submitterNamespace,
        submitterNamespaceIdentifier,
        seed: didCreateMode.endorseDidTxAction.secret?.seed as Buffer,
        privateKey: didCreateMode.endorseDidTxAction.secret?.privateKey as Buffer,
      }
    }

    const allowOne = [privateKey, seed, did].filter((e) => e !== undefined)
    if (allowOne.length > 1) {
      return {
        status: 'error',
        reason: `Only one of 'seed', 'privateKey' and 'did' must be provided`,
      }
    }

    if (did) {
      if (!options.options.verkey) {
        return {
          status: 'error',
          reason: 'If a did is defined, a matching verkey must be provided',
        }
      }

      const { namespace, namespaceIdentifier: _namespaceIdentifier } = parseIndyDid(did)
      namespaceIdentifier = _namespaceIdentifier
      verificationKey = Key.fromPublicKeyBase58(options.options.verkey, KeyType.Ed25519)

      if (!isSelfCertifiedIndyDid(did, options.options.verkey)) {
        return {
          status: 'error',
          reason: `Initial verkey ${options.options.verkey} does not match did ${did}`,
        }
      }

      if (submitterNamespace !== namespace) {
        return {
          status: 'error',
          reason: `The submitter did uses namespace ${submitterNamespace} and the did to register uses namespace ${namespace}. Namespaces must match.`,
        }
      }
    } else {
      // Create a new key and calculate did according to the rules for indy did method
      verificationKey = await agentContext.wallet.createKey({ privateKey, seed, keyType: KeyType.Ed25519 })
      const buffer = Hasher.hash(verificationKey.publicKey, 'sha2-256')

      namespaceIdentifier = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
      did = `did:indy:${submitterNamespace}:${namespaceIdentifier}`
    }

    return {
      status: 'ok',
      did,
      verificationKey,
      namespaceIdentifier,
      namespace: submitterNamespace,
      submitterNamespaceIdentifier,
      seed,
      privateKey,
    }
  }

  public async saveDidRecord(agentContext: AgentContext, did: string, didDocument: DidDocument): Promise<void> {
    // Save the did so we know we created it and can issue with it
    const didRecord = new DidRecord({
      did,
      role: DidDocumentRole.Created,
      tags: {
        recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
      },
    })

    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    await didRepository.save(agentContext, didRecord)
  }

  private createDidDocument(
    did: string,
    verificationKey: Key,
    services: DidDocumentService[] | undefined,
    useEndpointAttrib: boolean | undefined
  ) {
    // Create base did document
    const didDocumentBuilder = indyDidDocumentFromDid(did, verificationKey.publicKeyBase58)
    let diddocContent

    // Add services if object was passed
    if (services) {
      services.forEach((item) => {
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
      })

      const commTypes = [IndyAgentService.type, DidCommV1Service.type, DidCommV2Service.type]
      const serviceTypes = new Set(services.map((item) => item.type))

      const keyAgreementId = `${did}#key-agreement-1`

      // If there is at least a communication service, add the key agreement key
      if (commTypes.some((type) => serviceTypes.has(type))) {
        didDocumentBuilder
          .addContext('https://w3id.org/security/suites/x25519-2019/v1')
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(verificationKey.publicKeyBase58),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)
      }

      // If there is a DIDComm V2 service, add context
      if (serviceTypes.has(DidCommV2Service.type)) {
        didDocumentBuilder.addContext('https://didcomm.org/messaging/contexts/v2')
      }

      if (!useEndpointAttrib) {
        // create diddocContent parameter based on the diff between the base and the resulting DID Document
        diddocContent = didDocDiff(
          didDocumentBuilder.build().toJSON(),
          indyDidDocumentFromDid(did, verificationKey.publicKeyBase58).build().toJSON()
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

  public async create(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<IndyVdrDidCreateResult> {
    try {
      const res = await this.parseInput(agentContext, options)
      if (res.status === 'error') return this.didCreateFailedResult({ reason: res.reason })

      const didCreateMode = options.options.mode
      const { did, namespaceIdentifier, submitterNamespaceIdentifier, verificationKey, namespace, seed, privateKey } =
        res

      const pool = agentContext.dependencyManager.resolve(IndyVdrPoolService).getPoolForNamespace(namespace)

      let nymRequest: NymRequest | CustomRequest
      let didDocument: DidDocument
      let attribRequest: AttribRequest | CustomRequest | undefined
      let alias: string | undefined

      if (didCreateMode.type === 'submit') {
        ;({ nymRequest, didDocument, attribRequest } = didCreateMode.endorseDidTxAction)
      } else {
        const { services, useEndpointAttrib } = options.options
        alias = options.options.alias
        if (!verificationKey) throw new Error('VerificationKey not defined')

        const { didDocument: _didDocument, diddocContent } = this.createDidDocument(
          did,
          verificationKey,
          services,
          useEndpointAttrib
        )
        didDocument = _didDocument

        let didRegisterSigningKey: Key | undefined = undefined
        if (didCreateMode.type === 'create')
          didRegisterSigningKey = await verificationKeyForIndyDid(agentContext, didCreateMode.submitterDid)

        nymRequest = await this.createRegisterDidWriteRequest({
          agentContext,
          pool,
          signingKey: didRegisterSigningKey,
          submitterNamespaceIdentifier,
          namespaceIdentifier,
          verificationKey,
          alias,
          diddocContent,
        })

        if (services && useEndpointAttrib) {
          const endpoints = endpointsAttribFromServices(services)
          attribRequest = await this.createSetDidEndpointsRequest({
            agentContext,
            pool,
            signingKey: verificationKey,
            endorserDid: didCreateMode.type === 'toBeEndorsed' ? didCreateMode.endorserDid : undefined,
            unqualifiedDid: namespaceIdentifier,
            endpoints,
          })
        }

        if (didCreateMode.type === 'toBeEndorsed') {
          const didAction: EndorseDidTxAction = {
            state: 'action',
            name: 'signNymTx',
            endorserDid: didCreateMode.endorserDid,
            nymRequest,
            attribRequest,
            didDocument,
            secret: { seed, privateKey },
          }

          return this.didCreateActionResult({ namespace, didAction, jobId: did })
        }
      }
      await this.registerPublicDid(agentContext, pool, nymRequest)
      if (attribRequest) await this.setEndpointsForDid(agentContext, pool, attribRequest)
      await this.saveDidRecord(agentContext, did, didDocument)
      return this.didCreateFinishedResult({ did, didDocument, namespace, seed, privateKey })
    } catch (error) {
      return this.didCreateFailedResult({ reason: `unknownError: ${error.message}` })
    }
  }

  public async update(): Promise<DidUpdateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: updating did:indy not implemented yet`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:indy not implemented yet`,
      },
    }
  }

  private async createRegisterDidWriteRequest(options: {
    agentContext: AgentContext
    pool: IndyVdrPool
    submitterNamespaceIdentifier: string
    namespaceIdentifier: string
    verificationKey: Key
    signingKey?: Key
    alias: string | undefined
    diddocContent?: Record<string, unknown>
  }) {
    const {
      agentContext,
      pool,
      submitterNamespaceIdentifier,
      namespaceIdentifier,
      verificationKey,
      alias,
      signingKey,
    } = options

    // FIXME: Add diddocContent when supported by indy-vdr
    if (options.diddocContent) {
      throw new IndyVdrError('diddocContent is not yet supported')
    }

    const request = new NymRequest({
      submitterDid: submitterNamespaceIdentifier,
      dest: namespaceIdentifier,
      verkey: verificationKey.publicKeyBase58,
      alias: alias,
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
    signingKey: Key
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

export type DidCreateMode =
  | { type: 'toBeEndorsed'; endorserDid: string }
  | { type: 'create'; submitterDid: string }
  | { type: 'submit'; endorseDidTxAction: EndorseDidTxAction }

interface IndyVdrDidCreateOptionsBase extends DidCreateOptions {
  didDocument?: never // Not yet supported
  options: {
    alias?: string
    role?: string
    services?: DidDocumentService[]
    useEndpointAttrib?: boolean
    verkey?: string

    mode: DidCreateMode
  }
  secret?: {
    seed?: Buffer
    privateKey?: Buffer
  }
}

interface IndyVdrDidCreateOptionsWithDid extends IndyVdrDidCreateOptionsBase {
  method?: never
  did: string
}

interface IndyVdrDidCreateOptionsWithoutDid extends IndyVdrDidCreateOptionsBase {
  method: 'indy'
  did?: never
}

export type IndyVdrDidCreateOptions = IndyVdrDidCreateOptionsWithDid | IndyVdrDidCreateOptionsWithoutDid

type ParseInputOk = {
  status: 'ok'
  did: string
  verificationKey?: Key
  namespaceIdentifier: string
  namespace: string
  submitterNamespaceIdentifier: string
  seed: Buffer | undefined
  privateKey: Buffer | undefined
}

type parseInputError = { status: 'error'; reason: string }

type ParseInputResult = ParseInputOk | parseInputError

export interface EndorseDidTxAction extends DidOperationStateActionBase {
  name: 'signNymTx'
  endorserDid: string
  nymRequest: NymRequest | CustomRequest
  attribRequest?: AttribRequest | CustomRequest
  didDocument: DidDocument
}

export type IndyVdrDidCreateResult = DidCreateResult<EndorseDidTxAction>
