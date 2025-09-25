/**
 * BIP39 Deterministic P-256 Key Generation for Credo-TS v0.5.17
 *
 * Provides utilities to generate deterministic P-256 passkeys using @algorandfoundation/dp256
 * for integration with existing Credo wallet implementations.
 */

import type { WalletCreateKeyOptions } from '../Wallet'

import { DeterministicP256 } from '@algorandfoundation/dp256'

import { Key, KeyType } from '../../crypto'
import { CredoError } from '../../error'

export interface DeterministicP256Options {
  /** BIP39 mnemonic phrase */
  mnemonic: string
  /** WebAuthn origin/domain */
  origin: string
  /** WebAuthn user handle/identifier */
  userHandle: string
  /** Optional counter for multiple keys */
  counter?: number
}

// Extend Credo's wallet create key options to include our P-256 options
export interface BIP39WalletCreateKeyOptions extends WalletCreateKeyOptions {
  /** Options for deterministic P-256 passkey generation */
  p256Options?: DeterministicP256Options
}

/**
 * Create a deterministic P-256 passkey using BIP39 mnemonic and domain-specific information.
 *
 * @param options - P-256 key generation options including mnemonic, origin, and userHandle
 * @returns Promise<Key> - A Credo Key instance with the generated P-256 public key
 */
export async function createDeterministicP256Key(options: DeterministicP256Options): Promise<Key> {
  const { mnemonic, origin, userHandle, counter = 0 } = options

  try {
    const dp256 = new DeterministicP256()

    // Generate deterministic key from mnemonic + domain info
    const mainKey = await dp256.genDerivedMainKeyWithBIP39(mnemonic)
    const privateKey = await dp256.genDomainSpecificKeyPair(mainKey, origin, userHandle, counter)
    const publicKeyBytes = dp256.getPurePKBytes(privateKey)

    // Create Key object for Credo v0.5.17
    return Key.fromPublicKey(publicKeyBytes, KeyType.P256)
  } catch (error) {
    throw new CredoError(
      `Failed to generate deterministic P-256 passkey: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error }
    )
  }
}

/**
 * Check if the given create key options are for a P-256 key with deterministic options.
 *
 * @param options - Wallet create key options with potential P-256 options
 * @returns boolean - True if this is a P-256 key request with p256Options
 */
export function isP256DeterministicRequest(options: BIP39WalletCreateKeyOptions): boolean {
  return options.keyType === KeyType.P256 && !!options.p256Options
}

/**
 * Enhanced createKey function that supports deterministic P-256 generation.
 * Use this to wrap your existing wallet's createKey method.
 *
 * @param originalCreateKey - The original wallet createKey function
 * @param options - Enhanced options with optional p256Options
 * @returns Promise<Key> - Generated key (deterministic P-256 or delegated to original)
 */
export async function enhancedCreateKey(
  originalCreateKey: (options: WalletCreateKeyOptions) => Promise<Key>,
  options: BIP39WalletCreateKeyOptions
): Promise<Key> {
  // Check if this is a P-256 key request
  if (options.keyType === KeyType.P256) {
    // If p256Options are provided, use deterministic generation
    if (options.p256Options) {
      return createDeterministicP256Key(options.p256Options)
    }
    // If it's P-256 but no p256Options, delegate to original createKey
    // (This allows for regular P-256 key generation without deterministic options)
  }

  // For all other keys, delegate to original createKey
  return originalCreateKey(options)
}
