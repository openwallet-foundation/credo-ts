import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { IndyWallet } from '../../../../wallet/IndyWallet'
import type { IndyLedgerService } from '../../../ledger'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidRepository } from '../../repository'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'
import type * as Indy from 'indy-sdk'

import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../../repository'

import { sovDidDocumentFromDid } from './util'

export class SovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['sov']
  private wallet: IndyWallet
  private didRepository: DidRepository
  private indy: typeof Indy
  private indyLedgerService: IndyLedgerService

  public constructor(
    wallet: IndyWallet,
    didRepository: DidRepository,
    agentConfig: AgentConfig,
    indyLedgerService: IndyLedgerService
  ) {
    this.wallet = wallet
    this.didRepository = didRepository
    this.indy = agentConfig.agentDependencies.indy
    this.indyLedgerService = indyLedgerService
  }

  public async create(options: SovDidCreateOptions): Promise<DidCreateResult> {
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

    if (options.didDocument) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'didDocumentNotSupported: providing did document not supported for did:sov dids',
        },
      }
    }

    try {
      // NOTE: we need to use the createAndStoreMyDid method from indy to create the did
      // If we just create a key and handle the creating of the did ourselves, indy will throw a
      // WalletItemNotFound when it needs to sign ledger transactions using this did. This means we need
      // to rely directly on the indy SDK, as we don't want to expose a createDid method just for.
      // FIXME: once askar/indy-vdr is supported we need to adjust this to work with both indy-sdk and askar
      const [indyDid, verkey] = await this.indy.createAndStoreMyDid(this.wallet.handle, {
        seed,
      })

      const fullDid = `did:sov:${indyDid}`

      if (!submitterDid.startsWith('did:sov:')) {
        throw new Error('Submitter did must a valid did:sov did')
      }

      await this.indyLedgerService.registerPublicDid(submitterDid.replace('did:sov:', ''), indyDid, verkey, alias, role)
      await this.indyLedgerService.setEndpointsForDid(submitterDid.replace('did:sov:', ''), {
        endpoint: 'http://localhost:8080',
      })

      const didDocument = sovDidDocumentFromDid(fullDid, verkey).build()

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        id: fullDid,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeys: didDocument.recipientKeys,
        },
      })
      await this.didRepository.save(didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: fullDid,
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
        reason: `notSupported: cannot update did:sov did`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notSupported: cannot deactivate did:sov did`,
      },
    }
  }
}

export interface SovDidCreateOptions extends DidCreateOptions {
  method: 'sov'
  did?: undefined
  // TODO: support setting services. We first need to support setting attrib data
  // in the indy ledger service. For now we can only create public dids without any services
  didDocument?: undefined
  options: {
    alias: string
    role?: Indy.NymRole
    submitterDid: string
  }
  secret?: {
    seed?: string
  }
}

// Update and Deactivate not supported for did:sov
export type IndyDidUpdateOptions = never
export type IndyDidDeactivateOptions = never
