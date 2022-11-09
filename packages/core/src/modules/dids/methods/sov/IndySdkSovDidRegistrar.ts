import type { AgentContext } from '../../../../agent'
import type { IndyEndpointAttrib, IndyPool } from '../../../ledger'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'
import type * as Indy from 'indy-sdk'

import { AgentDependencies } from '../../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../../constants'
import { IndySdkError } from '../../../../error'
import { Logger } from '../../../../logger'
import { inject, injectable } from '../../../../plugins'
import { isIndyError } from '../../../../utils/indyError'
import { assertIndyWallet } from '../../../../wallet/util/assertIndyWallet'
import { IndyPoolService } from '../../../ledger'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../repository'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './util'

@injectable()
export class IndySdkSovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['sov']
  private didRepository: DidRepository
  private indy: typeof Indy
  private indyPoolService: IndyPoolService
  private logger: Logger

  public constructor(
    didRepository: DidRepository,
    indyPoolService: IndyPoolService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.didRepository = didRepository
    this.indy = agentDependencies.indy
    this.indyPoolService = indyPoolService
    this.logger = logger
  }

  public async create(agentContext: AgentContext, options: SovDidCreateOptions): Promise<DidCreateResult> {
    const { alias, role, submitterDid, indyNamespace } = options.options
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
      // FIXME: once askar/indy-vdr is supported we need to adjust this to work with both indy-sdk and askar
      assertIndyWallet(agentContext.wallet)
      const [unqualifiedIndyDid, verkey] = await this.indy.createAndStoreMyDid(agentContext.wallet.handle, {
        seed,
      })

      const qualifiedSovDid = `did:sov:${unqualifiedIndyDid}`
      const unqualifiedSubmitterDid = submitterDid.replace('did:sov:', '')

      // TODO: it should be possible to pass the pool used for writing to the indy ledger service.
      // The easiest way to do this would be to make the submitterDid a fully qualified did, including the indy namespace.
      const pool = this.indyPoolService.getPoolForNamespace(indyNamespace)
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
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
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
    pool: IndyPool,
    role?: Indy.NymRole
  ) {
    try {
      this.logger.debug(`Register public did '${targetDid}' on ledger '${pool.id}'`)

      const request = await this.indy.buildNymRequest(submitterDid, targetDid, verkey, alias, role || null)

      const response = await this.indyPoolService.submitWriteRequest(agentContext, pool, request, submitterDid)

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
        pool: pool.id,
      })

      throw error
    }
  }

  public async setEndpointsForDid(
    agentContext: AgentContext,
    did: string,
    endpoints: IndyEndpointAttrib,
    pool: IndyPool
  ): Promise<void> {
    try {
      this.logger.debug(`Set endpoints for did '${did}' on ledger '${pool.id}'`, endpoints)

      const request = await this.indy.buildAttribRequest(did, did, null, { endpoint: endpoints }, null)

      const response = await this.indyPoolService.submitWriteRequest(agentContext, pool, request, did)
      this.logger.debug(`Successfully set endpoints for did '${did}' on ledger '${pool.id}'`, {
        response,
        endpoints,
      })
    } catch (error) {
      this.logger.error(`Error setting endpoints for did '${did}' on ledger '${pool.id}'`, {
        error,
        did,
        endpoints,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}

export interface SovDidCreateOptions extends DidCreateOptions {
  method: 'sov'
  did?: undefined
  // As did:sov is so limited, we require everything needed to construct the did document to be passed
  // through the options object. Once we support did:indy we can allow the didDocument property.
  didDocument?: never
  options: {
    alias: string
    role?: Indy.NymRole
    endpoints?: IndyEndpointAttrib
    indyNamespace?: string
    submitterDid: string
  }
  secret?: {
    seed?: string
  }
}

// Update and Deactivate not supported for did:sov
export type IndyDidUpdateOptions = never
export type IndyDidDeactivateOptions = never
