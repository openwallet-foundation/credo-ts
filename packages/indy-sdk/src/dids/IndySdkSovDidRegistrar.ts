import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndySdkPool } from '../ledger'
import type { IndySdk } from '../types'
import type {
  AgentContext,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidUpdateResult,
  Key,
  Buffer,
} from '@aries-framework/core'
import type { NymRole } from 'indy-sdk'

import { DidDocumentRole, DidRecord, DidRepository } from '@aries-framework/core'

import { IndySdkError } from '../error'
import { isIndyError } from '../error/indyError'
import { IndySdkPoolService } from '../ledger'
import { IndySdkSymbol } from '../types'
import { assertIndySdkWallet } from '../utils/assertIndySdkWallet'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './didSovUtil'

export class IndySdkSovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['sov']

  public async create(agentContext: AgentContext, options: IndySdkSovDidCreateOptions): Promise<DidCreateResult> {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const { alias, role, submitterDid, indyNamespace } = options.options
    const privateKey = options.secret?.privateKey

    if (privateKey && (typeof privateKey !== 'object' || privateKey.length !== 32)) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Invalid private key provided',
        },
      }
    }

    if (!submitterDid.startsWith('did:sov:')) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Submitter did must be a valid did:sov did',
        },
      }
    }

    try {
      // NOTE: we need to use the createAndStoreMyDid method from indy to create the did
      // If we just create a key and handle the creating of the did ourselves, indy will throw a
      // WalletItemNotFound when it needs to sign ledger transactions using this did. This means we need
      // to rely directly on the indy SDK, as we don't want to expose a createDid method just for.
      assertIndySdkWallet(agentContext.wallet)
      const [unqualifiedIndyDid, verkey] = await indySdk.createAndStoreMyDid(agentContext.wallet.handle, {
        seed: privateKey?.toString(),
      })

      const qualifiedSovDid = `did:sov:${unqualifiedIndyDid}`
      const unqualifiedSubmitterDid = submitterDid.replace('did:sov:', '')

      const pool = indySdkPoolService.getPoolForNamespace(indyNamespace)
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
        did: qualifiedSovDid,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
          qualifiedIndyDid,
        },
      })
      await didRepository.save(agentContext, didRecord)

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
            privateKey: options.secret?.privateKey?.toString(),
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
    pool: IndySdkPool,
    role?: NymRole
  ) {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    try {
      agentContext.config.logger.debug(`Register public did '${targetDid}' on ledger '${pool.didIndyNamespace}'`)

      const request = await indySdk.buildNymRequest(submitterDid, targetDid, verkey, alias, role || null)

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, submitterDid)

      agentContext.config.logger.debug(`Registered public did '${targetDid}' on ledger '${pool.didIndyNamespace}'`, {
        response,
      })

      return targetDid
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${targetDid}' on ledger '${pool.didIndyNamespace}'`,
        {
          error,
          submitterDid,
          targetDid,
          verkey,
          alias,
          role,
          pool: pool.didIndyNamespace,
        }
      )

      throw error
    }
  }

  public async setEndpointsForDid(
    agentContext: AgentContext,
    did: string,
    endpoints: IndyEndpointAttrib,
    pool: IndySdkPool
  ): Promise<void> {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    try {
      agentContext.config.logger.debug(`Set endpoints for did '${did}' on ledger '${pool.didIndyNamespace}'`, endpoints)

      const request = await indySdk.buildAttribRequest(did, did, null, { endpoint: endpoints }, null)

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, did)
      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${did}' on ledger '${pool.didIndyNamespace}'`,
        {
          response,
          endpoints,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error setting endpoints for did '${did}' on ledger '${pool.didIndyNamespace}'`,
        {
          error,
          did,
          endpoints,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}

export interface IndySdkSovDidCreateOptions extends DidCreateOptions {
  method: 'sov'
  did?: undefined
  // As did:sov is so limited, we require everything needed to construct the did document to be passed
  // through the options object. Once we support did:indy we can allow the didDocument property.
  didDocument?: never
  options: {
    alias: string
    role?: NymRole
    endpoints?: IndyEndpointAttrib
    indyNamespace?: string
    submitterDid: string
  }
  secret?: {
    privateKey?: Buffer
  }
}

// Update and Deactivate not supported for did:sov
export type IndySdkSovDidUpdateOptions = never
export type IndySdkSovDidDeactivateOptions = never
