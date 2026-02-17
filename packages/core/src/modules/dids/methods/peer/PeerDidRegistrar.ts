import type { AgentContext } from '../../../../agent'
import type { XOR } from '../../../../types'
import { JsonTransformer } from '../../../../utils'
import {
  Ed25519PublicJwk,
  KeyManagementApi,
  type KmsCreateKeyOptions,
  type KmsCreateKeyTypeAssymetric,
  PublicJwk,
  X25519PublicJwk,
} from '../../../kms'
import type { DidDocumentKey } from '../../DidsApiOptions'
import { DidDocument } from '../../domain'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { getPublicJwkFromVerificationMethod } from '../../domain/key-type'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import { DidRecord, DidRepository } from '../../repository'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'
import { getAlternativeDidsForPeerDid, PeerDidNumAlgo } from './didPeer'
import { publicJwkToNumAlgo0DidDocument } from './peerDidNumAlgo0'
import { didDocumentJsonToNumAlgo1Did } from './peerDidNumAlgo1'
import { didDocumentToNumAlgo2Did } from './peerDidNumAlgo2'
import { didDocumentToNumAlgo4Did } from './peerDidNumAlgo4'

/**
 * Collect recipient key fingerprints from authentication and keyAgreement.
 * Includes X25519 conversion for Ed25519 keys so DIDComm v2 lookup works when
 * message uses authentication kid (#key-1) but DidRecord stores keyAgreement.
 */
function getRecipientKeyFingerprintsIncludingAuthAndKeyAgreement(didDocument: DidDocument): string[] {
  const prints = new Set<string>()
  const keyRefs = [
    ...(didDocument.authentication ?? []),
    ...(didDocument.keyAgreement ?? []),
  ]
  const seen = new Set<string>()
  for (const keyRef of keyRefs) {
    const vm = typeof keyRef === 'string' ? didDocument.dereferenceVerificationMethod(keyRef) : keyRef
    if (seen.has(vm.id)) continue
    seen.add(vm.id)
    const publicJwk = getPublicJwkFromVerificationMethod(vm)
    if (publicJwk.is(Ed25519PublicJwk) || publicJwk.is(X25519PublicJwk)) {
      prints.add(publicJwk.fingerprint)
      if (publicJwk.is(Ed25519PublicJwk)) {
        prints.add((publicJwk as PublicJwk<Ed25519PublicJwk>).convertTo(X25519PublicJwk).fingerprint)
      }
    }
  }
  return [...prints]
}

export class PeerDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['peer']

  public async create(
    agentContext: AgentContext,
    options:
      | PeerDidNumAlgo0CreateOptions
      | PeerDidNumAlgo1CreateOptions
      | PeerDidNumAlgo2CreateOptions
      | PeerDidNumAlgo4CreateOptions
  ): Promise<DidCreateResult> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    let did: string
    let didDocument: DidDocument

    let keys: DidDocumentKey[]

    try {
      if (isPeerDidNumAlgo0CreateOptions(options)) {
        let publicJwk: PublicJwk

        if (options.options.createKey) {
          const createKeyResult = await kms.createKey(options.options.createKey)
          publicJwk = PublicJwk.fromPublicJwk(createKeyResult.publicJwk)
          keys = [
            {
              didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
              kmsKeyId: createKeyResult.keyId,
            },
          ]
        } else {
          const _publicJwk = await kms.getPublicKey({
            keyId: options.options.keyId,
          })

          if (!_publicJwk) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `notFound: key with key id '${options.options.keyId}' not found`,
              },
            }
          }

          if (_publicJwk.kty === 'oct') {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `notFound: key with key id '${options.options.keyId}' uses unsupported kty 'oct' for did:key`,
              },
            }
          }

          publicJwk = PublicJwk.fromPublicJwk(_publicJwk)
          keys = [
            {
              didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
              kmsKeyId: options.options.keyId,
            },
          ]
        }

        didDocument = publicJwkToNumAlgo0DidDocument(publicJwk)
        did = didDocument.id
      } else if (isPeerDidNumAlgo1CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()
        did = didDocumentJsonToNumAlgo1Did(didDocumentJson)
        keys = options.options.keys

        didDocument = JsonTransformer.fromJSON({ ...didDocumentJson, id: did }, DidDocument)
      } else if (isPeerDidNumAlgo2CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()
        did = didDocumentToNumAlgo2Did(options.didDocument)
        keys = options.options.keys

        didDocument = JsonTransformer.fromJSON({ ...didDocumentJson, id: did }, DidDocument)
      } else if (isPeerDidNumAlgo4CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()
        keys = options.options.keys

        const { longFormDid, shortFormDid } = didDocumentToNumAlgo4Did(options.didDocument)

        did = longFormDid
        didDocument = JsonTransformer.fromJSON(
          { ...didDocumentJson, id: longFormDid, alsoKnownAs: [shortFormDid] },
          DidDocument
        )
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Missing or incorrect numAlgo provided',
          },
        }
      }

      if (!keys || keys.length === 0) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: `Missing required 'keys' linking did document verification method id to the kms key id. Provide at least one key in the create options`,
          },
        }
      }

      // Build recipientKeyFingerprints. For numAlgo 2 (v2 OOB peer DIDs), include both
      // authentication and keyAgreement so lookup works when message uses #key-1 (Ed25519).
      const recipientKeyFingerprints =
        isPeerDidNumAlgo2CreateOptions(options) || isPeerDidNumAlgo4CreateOptions(options)
          ? getRecipientKeyFingerprintsIncludingAuthAndKeyAgreement(didDocument)
          : didDocument.recipientKeys.map((key) => key.fingerprint)

      // Save the did so we know we created it and can use it for didcomm
      const didRecord = new DidRecord({
        did,
        role: DidDocumentRole.Created,
        didDocument: isPeerDidNumAlgo1CreateOptions(options) ? didDocument : undefined,
        keys,
        tags: {
          recipientKeyFingerprints,
          alternativeDids: getAlternativeDidsForPeerDid(did),
        },
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument,
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
        reason: 'notImplemented: updating did:peer not implemented yet',
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: deactivating did:peer not implemented yet',
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

function isPeerDidNumAlgo4CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo4CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.ShortFormAndLongForm
}

export type PeerDidCreateOptions =
  | PeerDidNumAlgo0CreateOptions
  | PeerDidNumAlgo1CreateOptions
  | PeerDidNumAlgo2CreateOptions
  | PeerDidNumAlgo4CreateOptions

export interface PeerDidNumAlgo0CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument?: never
  options: {
    numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc
  } & XOR<{ createKey: KmsCreateKeyOptions<KmsCreateKeyTypeAssymetric> }, { keyId: string }>
  secret?: never
}

export interface PeerDidNumAlgo1CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.GenesisDoc

    /**
     * The linking between the did document keys and the kms keys. If you want to use
     * the DID within Credo you MUST add the key here. All keys must be present in the did
     * document, but not all did document keys must be present in this array, to allow for keys
     * that are not controleld by this agent.
     */
    keys: DidDocumentKey[]
  }
  secret?: never
}

export interface PeerDidNumAlgo2CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc

    /**
     * The linking between the did document keys and the kms keys. If you want to use
     * the DID within Credo you MUST add the key here. All keys must be present in the did
     * document, but not all did document keys must be present in this array, to allow for keys
     * that are not controleld by this agent.
     */
    keys: DidDocumentKey[]
  }
  secret?: never
}

export interface PeerDidNumAlgo4CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.ShortFormAndLongForm

    /**
     * The linking between the did document keys and the kms keys. If you want to use
     * the DID within Credo you MUST add the key here. All keys must be present in the did
     * document, but not all did document keys must be present in this array, to allow for keys
     * that are not controleld by this agent.
     */
    keys: DidDocumentKey[]
  }
  secret?: never
}

// Update and Deactivate not supported for did:peer
export type PeerDidUpdateOptions = never
export type PeerDidDeactivateOptions = never
