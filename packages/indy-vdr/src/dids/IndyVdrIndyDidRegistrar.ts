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
  }: {
    namespace: string
    didAction: EndorseDidTxAction
  }): IndyVdrDidCreateResult {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {
        didIndyNamespace: namespace,
      },
      didState: didAction,
    }
  }

  private didCreateFailedResult({ errorMessage }: { errorMessage: string }): IndyVdrDidCreateResult {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: errorMessage,
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

  public async parseInput(
    agentContext: AgentContext,
    options: IndyVdrDidCreateOptions,
    didCreateMode: DidCreateMode
  ): Promise<ParseInputResult> {
    let did = options.did
    let namespaceIdentifier: string
    let verificationKey: Key
    const seed = options.secret?.seed
    const privateKey = options.secret?.privateKey

    let submitterDid: string
    if (didCreateMode.type === 'toBeEndorsed') submitterDid = didCreateMode.endorserDid
    else if (didCreateMode.type === 'submit') submitterDid = didCreateMode.endorseDidTxAction.submitterDid
    else submitterDid = didCreateMode.submitterDid

    const { namespace: submitterNamespace, namespaceIdentifier: submitterNamespaceIdentifier } =
      parseIndyDid(submitterDid)

    if (didCreateMode.type === 'submit') {
      return {
        status: 'ok',
        did: didCreateMode.endorseDidTxAction.did,
        verificationKey: didCreateMode.endorseDidTxAction.verificationKey,
        namespaceIdentifier: parseIndyDid(didCreateMode.endorseDidTxAction.did).namespaceIdentifier,
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
        errorMessage: `Only one of 'seed', 'privateKey' and 'did' must be provided`,
      }
    }

    if (did) {
      if (!options.options.verkey) {
        return {
          status: 'error',
          errorMessage: 'If a did is defined, a matching verkey must be provided',
        }
      }

      const { namespace, namespaceIdentifier: _namespaceIdentifier } = parseIndyDid(did)
      namespaceIdentifier = _namespaceIdentifier
      verificationKey = Key.fromPublicKeyBase58(options.options.verkey, KeyType.Ed25519)

      if (!isSelfCertifiedIndyDid(did, options.options.verkey)) {
        return {
          status: 'error',
          errorMessage: `Initial verkey ${options.options.verkey} does not match did ${did}`,
        }
      }

      if (submitterNamespace !== namespace) {
        return {
          status: 'error',
          errorMessage: `The submitter did uses namespace ${submitterNamespace} and the did to register uses namespace ${namespace}. Namespaces must match.`,
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

  public createDidDocument(
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
    const { submitterDid, mode: _mode } = options.options
    const didCreateMode: DidCreateMode = _mode ?? { type: 'create', submitterDid }
    options.options.mode = didCreateMode

    try {
      const res = await this.parseInput(agentContext, options, didCreateMode)
      if (res.status === 'error') return this.didCreateFailedResult({ errorMessage: res.errorMessage })

      const { did, namespaceIdentifier, submitterNamespaceIdentifier, verificationKey, namespace, seed, privateKey } =
        res

      const pool = agentContext.dependencyManager.resolve(IndyVdrPoolService).getPoolForNamespace(namespace)

      let nymRequest: NymRequest | CustomRequest
      let didDocument: DidDocument
      let attribRequest: AttribRequest | CustomRequest | undefined
      let alias: string | undefined
      let role: string | undefined

      if (didCreateMode.type === 'submit') {
        ;({ nymRequest, didDocument, attribRequest, alias, role } = didCreateMode.endorseDidTxAction)
      } else {
        const { services, useEndpointAttrib } = options.options
        alias = options.options.alias
        role = options.options.role

        let createDidWriteMode: WriteRequestMode
        let setDidEndpointWriteMode: WriteRequestMode

        if (didCreateMode.type === 'create') {
          const submitterKey = await verificationKeyForIndyDid(agentContext, submitterDid)
          createDidWriteMode = { type: 'create', submitterKey }
          setDidEndpointWriteMode = { type: 'create', submitterKey: verificationKey }
        } else {
          createDidWriteMode = { type: 'toBeSigned' }
          setDidEndpointWriteMode = {
            type: 'toBeEndorsed',
            authorKey: verificationKey,
            endorserDid: didCreateMode.endorserDid,
          }
        }

        const { didDocument: _didDocument, diddocContent } = this.createDidDocument(
          did,
          verificationKey,
          services,
          useEndpointAttrib
        )
        didDocument = _didDocument

        nymRequest = await this.createRegisterDidWriteRequest({
          agentContext,
          pool,
          mode: createDidWriteMode,
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
            mode: setDidEndpointWriteMode,
            unqualifiedDid: namespaceIdentifier,
            endpoints,
          })
        }

        if (didCreateMode.type === 'toBeEndorsed') {
          const didAction: EndorseDidTxAction = {
            state: 'action',
            name: 'signNymTx',
            did,
            submitterDid,
            nymRequest,
            attribRequest,
            didDocument,
            verificationKey,
            secret: { seed, privateKey },
            alias,
            role,
          }

          return this.didCreateActionResult({ namespace, didAction })
        }
      }

      await this.registerPublicDid(
        agentContext,
        pool,
        nymRequest,
        submitterNamespaceIdentifier,
        verificationKey,
        namespaceIdentifier,
        alias,
        role
      )

      if (attribRequest) await this.setEndpointsForDid(agentContext, pool, namespaceIdentifier, attribRequest)
      await this.saveDidRecord(agentContext, did, didDocument)
      return this.didCreateFinishedResult({ did, didDocument, namespace, seed, privateKey })
    } catch (error) {
      return this.didCreateFailedResult({ errorMessage: `unknownError: ${error.message}` })
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
    mode: WriteRequestMode
    submitterNamespaceIdentifier: string
    namespaceIdentifier: string
    verificationKey: Key
    alias: string | undefined
    diddocContent?: Record<string, unknown>
  }) {
    const { agentContext, pool, mode, submitterNamespaceIdentifier, namespaceIdentifier, verificationKey, alias } =
      options

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

    const writeRequest = await pool.createWriteRequest(agentContext, request, mode)
    return writeRequest
  }

  private async registerPublicDid<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    writeRequest: Request,
    unqualifiedSubmitterDid: string,
    signingKey: Key,
    unqualifiedDid: string,
    alias?: string,
    role?: string
  ) {
    try {
      agentContext.config.logger.debug(`Register public did '${unqualifiedDid}' on ledger '${pool}'`)

      const response = await pool.submitWriteRequest(writeRequest)

      agentContext.config.logger.debug(`Registered public did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`, {
        response,
      })

      return
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          unqualifiedSubmitterDid,
          unqualifiedDid,
          signingKey,
          alias,
          role,
          pool: pool.indyNamespace,
        }
      )

      throw error
    }
  }

  private async createSetDidEndpointsRequest(options: {
    agentContext: AgentContext
    pool: IndyVdrPool
    mode: WriteRequestMode
    unqualifiedDid: string
    endpoints: IndyEndpointAttrib
  }): Promise<AttribRequest> {
    const { agentContext, mode, pool, endpoints, unqualifiedDid } = options
    const request = new AttribRequest({
      submitterDid: unqualifiedDid,
      targetDid: unqualifiedDid,
      raw: JSON.stringify({ endpoint: endpoints }),
    })

    const writeRequest = await pool.createWriteRequest(agentContext, request, mode)
    return writeRequest
  }

  private async setEndpointsForDid<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    unqualifiedDid: string,
    writeRequest: Request
  ): Promise<void> {
    try {
      agentContext.config.logger.debug(`Set endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`)

      const response = await pool.submitWriteRequest(writeRequest)

      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          response,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error setting endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          unqualifiedDid,
        }
      )

      throw new IndyVdrError(error)
    }
  }
}

export type DidCreateMode =
  | { type: 'toBeEndorsed'; endorserDid: string }
  | { type: 'create'; submitterDid: string }
  | { type: 'submit'; endorseDidTxAction: EndorseDidTxAction }

export type WriteRequestMode =
  | { type: 'toBeEndorsed'; endorserDid: string; authorKey: Key }
  | { type: 'toBeSigned' }
  | { type: 'create'; submitterKey: Key }

interface IndyVdrDidCreateOptionsBase extends DidCreateOptions {
  didDocument?: never // Not yet supported
  options: {
    alias?: string
    role?: string
    services?: DidDocumentService[]
    useEndpointAttrib?: boolean
    verkey?: string

    submitterDid: string
    mode?: DidCreateMode
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
  verificationKey: Key
  namespaceIdentifier: string
  namespace: string
  submitterNamespaceIdentifier: string
  seed: Buffer | undefined
  privateKey: Buffer | undefined
}

type parseInputError = { status: 'error'; errorMessage: string }

type ParseInputResult = ParseInputOk | parseInputError

export interface EndorseDidTxAction extends DidOperationStateActionBase {
  name: 'signNymTx'
  did: string
  submitterDid: string
  nymRequest: NymRequest | CustomRequest
  attribRequest?: AttribRequest | CustomRequest
  didDocument: DidDocument
  verificationKey: Key
  role?: string
  alias?: string
}

export type IndyVdrDidCreateResult = DidCreateResult<EndorseDidTxAction>
