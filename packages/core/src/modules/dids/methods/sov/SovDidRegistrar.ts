import type { AgentContext } from '../../../../agent'
import type { IndyEndpointAttrib } from '../../../ledger'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'
import type * as Indy from 'indy-sdk'

import { AgentDependencies } from '../../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../../constants'
import { inject, injectable } from '../../../../plugins'
import { assertIndyWallet } from '../../../../wallet/util/assertIndyWallet'
import { IndyLedgerService, IndyPoolService } from '../../../ledger'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../repository'

import { addServicesFromEndpointsAttrib, sovDidDocumentFromDid } from './util'

@injectable()
export class SovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['sov']
  private didRepository: DidRepository
  private indy: typeof Indy
  private indyLedgerService: IndyLedgerService
  private indyPoolService: IndyPoolService

  public constructor(
    didRepository: DidRepository,
    indyLedgerService: IndyLedgerService,
    indyPoolService: IndyPoolService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies
  ) {
    this.didRepository = didRepository
    this.indy = agentDependencies.indy
    this.indyLedgerService = indyLedgerService
    this.indyPoolService = indyPoolService
  }

  public async create(agentContext: AgentContext, options: SovDidCreateOptions): Promise<DidCreateResult> {
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
      await this.indyLedgerService.registerPublicDid(
        agentContext,
        unqualifiedSubmitterDid,
        unqualifiedIndyDid,
        verkey,
        alias,
        role
      )

      // Create did document
      const didDocumentBuilder = sovDidDocumentFromDid(qualifiedSovDid, verkey)

      // Add services if endpoints object was passed.
      if (options.options.endpoints) {
        await this.indyLedgerService.setEndpointsForDid(agentContext, unqualifiedIndyDid, options.options.endpoints)
        addServicesFromEndpointsAttrib(
          didDocumentBuilder,
          qualifiedSovDid,
          options.options.endpoints,
          `${qualifiedSovDid}#key-agreement-1`
        )
      }

      // Build did document.
      const didDocument = didDocumentBuilder.build()

      // FIXME: we need to update this to the `indyNamespace` once https://github.com/hyperledger/aries-framework-javascript/issues/944 has been resolved
      const indyNamespace = this.indyPoolService.ledgerWritePool.config.id
      const qualifiedIndyDid = `did:indy:${indyNamespace}:${unqualifiedIndyDid}`

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
          indyNamespace,
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
    submitterDid: string
  }
  secret?: {
    seed?: string
  }
}

// Update and Deactivate not supported for did:sov
export type IndyDidUpdateOptions = never
export type IndyDidDeactivateOptions = never
