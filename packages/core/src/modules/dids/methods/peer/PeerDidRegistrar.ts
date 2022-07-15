import type { AgentContext } from '../../../../agent'
import type { KeyType } from '../../../../crypto'
import type { DidDocument } from '../../domain'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidRepository } from '../../repository'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../../repository'

import { PeerDidNumAlgo } from './didPeer'
import { keyToNumAlgo0DidDocument } from './peerDidNumAlgo0'
import { didDocumentJsonToNumAlgo1Did } from './peerDidNumAlgo1'
import { didDocumentToNumAlgo2Did } from './peerDidNumAlgo2'

export class PeerDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['peer']
  private didRepository: DidRepository

  public constructor(didRepository: DidRepository) {
    this.didRepository = didRepository
  }

  public async create(
    agentContext: AgentContext,
    options: PeerDidNumAlgo0CreateOptions | PeerDidNumAlgo1CreateOptions | PeerDidNumAlgo2CreateOptions
  ): Promise<DidCreateResult> {
    let didDocument: DidDocument

    try {
      if (isPeerDidNumAlgo0CreateOptions(options)) {
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

        const key = await agentContext.wallet.createKey({
          keyType,
          seed,
        })

        didDocument = keyToNumAlgo0DidDocument(key)
      } else if (isPeerDidNumAlgo1CreateOptions(options)) {
        const did = didDocumentJsonToNumAlgo1Did(options.didDocument.toJSON())
        // FIXME: do not mutate input object
        options.didDocument.id = did
        didDocument = options.didDocument
      } else if (isPeerDidNumAlgo2CreateOptions(options)) {
        const did = didDocumentToNumAlgo2Did(options.didDocument)
        // FIXME: do not mutate input object
        options.didDocument.id = did
        didDocument = options.didDocument
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: `Missing or incorrect numAlgo provided`,
          },
        }
      }

      // Save the did so we know we created it and can use it for didcomm
      const didRecord = new DidRecord({
        id: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument: isPeerDidNumAlgo1CreateOptions(options) ? didDocument : undefined,
        tags: {
          // We need to save the recipientKeys, so we can find the associated did
          // of a key when we receive a message from another connection.
          recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
        },
      })
      await this.didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
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
          reason: `unknown error: ${error.message}`,
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
        reason: `notSupported: cannot update did:peer did`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notSupported: cannot deactivate did:peer did`,
      },
    }
  }
}

function isPeerDidNumAlgo1CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo1CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.GenesisDoc
}

function isPeerDidNumAlgo0CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo0CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.InceptionKeyWithoutDoc
}

function isPeerDidNumAlgo2CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo2CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
}

export type PeerDidCreateOptions =
  | PeerDidNumAlgo0CreateOptions
  | PeerDidNumAlgo1CreateOptions
  | PeerDidNumAlgo2CreateOptions

export interface PeerDidNumAlgo0CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument?: never
  options: {
    keyType: KeyType.Ed25519
    numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc
  }
  secret?: {
    seed?: string
  }
}

export interface PeerDidNumAlgo1CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.GenesisDoc
  }
  secret?: undefined
}

export interface PeerDidNumAlgo2CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: undefined
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
  }
  secret?: undefined
}

// Update and Deactivate not supported for did:peer
export type PeerDidUpdateOptions = never
export type PeerDidDeactivateOptions = never
