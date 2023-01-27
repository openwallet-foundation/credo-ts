import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndyVdrPool } from '../pool'
import type {
  AgentContext,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidUpdateResult,
} from '@aries-framework/core'

import { Key, KeyType, injectable, DidDocumentRole, DidRecord, DidRepository } from '@aries-framework/core'
import { AttribRequest, NymRequest } from 'indy-vdr-test-shared'

import { parseDid } from 'packages/core/src/modules/dids/domain/parse'
import { IndyVdrError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './didSovUtil'

@injectable()
export class IndyVdrSovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']
  private didRepository: DidRepository
  private indyVdrPoolService: IndyVdrPoolService

  public constructor(didRepository: DidRepository, indyVdrPoolService: IndyVdrPoolService) {
    this.didRepository = didRepository
    this.indyVdrPoolService = indyVdrPoolService
  }

  public async create(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<DidCreateResult> {
    const { alias, role, submitterDid } = options.options
    const seed = options.secret?.seed

    if (seed && (typeof seed !== 'string' || seed.length !== 32)) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Invalid seed provided',
        },
      }
    }

    const DID_REGEX = 'did:([a-z0-9]+):([a-z0-9]+):([a-z0-9]+)'
    const [, method, namespace, unqualifiedSubmitterDid] = DID_REGEX.match(submitterDid)
    if (!(method === 'indy')) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Submitter did must be a valid did:indy did',
        },
      }
    }

    try {
      const key = await agentContext.wallet.createKey({ seed, keyType: KeyType.Ed25519 })

      const unqualifiedIndyDid = key.publicKeyBase58
      const verkey = key.fingerprint

      // TODO: it should be possible to pass the pool used for writing to the indy ledger service.
      // The easiest way to do this would be to make the submitterDid a fully qualified did, including the indy namespace.
      await this.registerPublicDid(agentContext, unqualifiedSubmitterDid, unqualifiedIndyDid, verkey, alias, pool, role)

      // Create did document
      const didDocumentBuilder = sovDidDocumentFromDid(qualifiedSovDid, verkey)

      // Add services if endpoints object was passed.
      if (options.options.endpoints) {
        await this.setEndpointsForDid(agentContext, unqualifiedIndyDid, options.options.endpoints, pool)
        addServicesFromEndpointsAttrib(
          didDocumentBuilder,
          qualifiedSovDid,
          options.options.endpoints,
          `${qualifiedSovDid}#key-agreement-1`
        )
      }

      // Build did document.
      const didDocument = didDocumentBuilder.build()

      const didIndyNamespace = pool.config.indyNamespace
      const qualifiedIndyDid = `did:indy:${didIndyNamespace}:${unqualifiedIndyDid}`

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        id: qualifiedSovDid,
        did: qualifiedSovDid,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
          qualifiedIndyDid,
        },
      })
      await this.didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {
          qualifiedIndyDid,
        },
        didRegistrationMetadata: {
          didIndyNamespace,
        },
        didState: {
          state: 'finished',
          did: qualifiedSovDid,
          didDocument,
          secret: {
            // FIXME: the uni-registrar creates the seed in the registrar method
            // if it doesn't exist so the seed can always be returned. Currently
            // we can only return it if the seed was passed in by the user. Once
            // we have a secure method for generating seeds we should use the same
            // approach
            seed: options.secret?.seed,
          },
        },
      }
    } catch (error) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async update(): Promise<DidUpdateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: updating did:sov not implemented yet`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:sov not implemented yet`,
      },
    }
  }

  public async registerPublicDid(
    agentContext: AgentContext,
    submitterDid: string,
    targetDid: string,
    verkey: string,
    alias: string,
    pool: IndyVdrPool,
    role?: string
  ) {
    try {
      agentContext.config.logger.debug(`Register public did '${targetDid}' on ledger '${pool}'`)

      await agentContext.wallet.createKey({ keyType: KeyType.Ed25519, seed: targetDid })

      const request = new NymRequest({ submitterDid, dest: targetDid, verkey, alias })

      const signingKey = Key.fromPublicKeyBase58(submitterDid, KeyType.Ed25519)

      const response = await pool.submitWriteRequest(agentContext, request, signingKey)

      agentContext.config.logger.debug(`Registered public did '${targetDid}' on ledger '${pool.indyNamespace}'`, {
        response,
      })

      return targetDid
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${targetDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          submitterDid,
          targetDid,
          verkey,
          alias,
          role,
          pool: pool.indyNamespace,
        }
      )

      throw error
    }
  }

  public async setEndpointsForDid(
    agentContext: AgentContext,
    did: string,
    endpoints: IndyEndpointAttrib,
    pool: IndyVdrPool
  ): Promise<void> {
    try {
      agentContext.config.logger.debug(`Set endpoints for did '${did}' on ledger '${pool.indyNamespace}'`, endpoints)

      const request = new AttribRequest({
        submitterDid: did,
        targetDid: did,
        raw: JSON.stringify({ endpoint: endpoints }),
      })

      const signingKey = Key.fromPublicKeyBase58(did, KeyType.Ed25519)
      const response = await pool.submitWriteRequest(agentContext, request, signingKey)
      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${did}' on ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(`Error setting endpoints for did '${did}' on ledger '${pool.indyNamespace}'`, {
        error,
        did,
        endpoints,
      })

      throw new IndyVdrError(error)
    }
  }
}

export interface IndyVdrDidCreateOptions extends DidCreateOptions {
  method: 'sov'
  did?: undefined
  // As did:sov is so limited, we require everything needed to construct the did document to be passed
  // through the options object. Once we support did:indy we can allow the didDocument property.
  didDocument?: never
  options: {
    alias: string
    role?: string
    endpoints?: IndyEndpointAttrib
    indyNamespace?: string
    submitterDid: string
  }
  secret?: {
    seed?: string
  }
}

// Update and Deactivate not supported for did:sov
export type IndyVdrSovDidUpdateOptions = never
export type IndyVdrSovDidDeactivateOptions = never
