import type { AgentContext } from '../../../../agent'
import type { KeyType } from '../../../../crypto'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import { injectable } from '../../../../plugins'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRepository, DidRecord } from '../../repository'

import { DidKey } from './DidKey'

@injectable()
export class KeyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['key']
  private didRepository: DidRepository

  public constructor(didRepository: DidRepository) {
    this.didRepository = didRepository
  }

  public async create(agentContext: AgentContext, options: KeyDidCreateOptions): Promise<DidCreateResult> {
    const keyType = options.options.keyType
    const seed = options.secret?.seed

    if (!keyType) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Missing key type',
        },
      }
    }

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

    try {
      const key = await agentContext.wallet.createKey({
        keyType,
        seed,
      })

      const didKey = new DidKey(key)

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        id: didKey.did,
        role: DidDocumentRole.Created,
      })
      await this.didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didKey.did,
          didDocument: didKey.didDocument,
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
        reason: `notSupported: cannot update did:key did`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notSupported: cannot deactivate did:key did`,
      },
    }
  }
}

export interface KeyDidCreateOptions extends DidCreateOptions {
  method: 'key'
  // For now we don't support creating a did:key with a did or did document
  did?: never
  didDocument?: never
  options: {
    keyType: KeyType
  }
  secret?: {
    seed?: string
  }
}

// Update and Deactivate not supported for did:key
export type KeyDidUpdateOptions = never
export type KeyDidDeactivateOptions = never
