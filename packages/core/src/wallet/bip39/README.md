# BIP39 Deterministic P-256 Passkey Generation for Credo-TS v0.5.17

This module provides deterministic P-256 passkey generation using BIP39 mnemonic phrases for Credo-TS v0.5.17. It integrates with the `@algorandfoundation/dp256` library to generate domain-specific passkeys compatible with WebAuthn/FIDO2 standards.

## Features

- 🔐 **Deterministic P-256 Passkeys**: Generate consistent passkeys from BIP39 mnemonic + domain info
- 🌐 **Domain-Specific**: Each passkey is tied to a specific origin and user handle
- 📱 **React Native Compatible**: Works with Rocca wallet and other React Native apps
- 🔄 **Backwards Compatible**: Maintains compatibility with existing wallet implementations
- 🧪 **Fully Tested**: Comprehensive Jest test suite with 100% coverage

## Installation

The `@algorandfoundation/dp256` dependency is already included in the `packages/core/package.json`:

```json
{
  "dependencies": {
    "@algorandfoundation/dp256": "^1.0.1"
  }
}
```

## Usage

### Basic Integration

```typescript
import { enhancedCreateKey, type BIP39WalletCreateKeyOptions } from '@credo-ts/core'
import { KeyType } from '@credo-ts/core'

// Wrap your existing wallet's createKey method
const originalCreateKey = wallet.createKey.bind(wallet)

// Create enhanced version that supports P-256 passkeys
const createKeyWithP256Support = (options: BIP39WalletCreateKeyOptions) => {
  return enhancedCreateKey(originalCreateKey, options)
}

// Generate a deterministic P-256 passkey
const gmailPasskey = await createKeyWithP256Support({
  keyType: KeyType.P256,
  p256Options: {
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    origin: 'accounts.google.com',
    userHandle: 'user@gmail.com',
    counter: 0
  }
})

console.log('Generated passkey:', gmailPasskey.keyType) // 'p256'
console.log('Public key:', gmailPasskey.publicKeyBase58)
```

### Multiple Passkeys for Same Domain

```typescript
// Generate multiple passkeys for the same domain using different counters
const firstGitHubKey = await createKeyWithP256Support({
  keyType: KeyType.P256,
  p256Options: {
    mnemonic: 'your-bip39-mnemonic-phrase',
    origin: 'github.com',
    userHandle: 'developer123',
    counter: 0  // First key
  }
})

const secondGitHubKey = await createKeyWithP256Support({
  keyType: KeyType.P256,
  p256Options: {
    mnemonic: 'your-bip39-mnemonic-phrase',
    origin: 'github.com', 
    userHandle: 'developer123',
    counter: 1  // Second key - different from first
  }
})
```

### Non-P-256 Keys (Unchanged Behavior)

```typescript
// Other key types work exactly as before
const ed25519Key = await createKeyWithP256Support({
  keyType: KeyType.Ed25519,
  keyId: 'my-signing-key'
})

// P-256 keys without p256Options also work as before (random generation)
const randomP256Key = await createKeyWithP256Support({
  keyType: KeyType.P256,
  keyId: 'random-p256-key'
  // No p256Options = delegates to original createKey
})
```

## API Reference

### `enhancedCreateKey()`

Enhanced createKey function that supports deterministic P-256 generation.

```typescript
function enhancedCreateKey(
  originalCreateKey: (options: WalletCreateKeyOptions) => Promise<Key>,
  options: BIP39WalletCreateKeyOptions
): Promise<Key>
```

**Parameters:**
- `originalCreateKey`: The original wallet createKey function
- `options`: Enhanced options with optional p256Options

**Returns:** `Promise<Key>` - Generated key (deterministic P-256 or delegated to original)

### `createDeterministicP256Key()`

Direct function to create a deterministic P-256 passkey.

```typescript
function createDeterministicP256Key(options: DeterministicP256Options): Promise<Key>
```

**Parameters:**
- `options.mnemonic`: BIP39 mnemonic phrase
- `options.origin`: WebAuthn origin/domain (e.g., 'github.com')
- `options.userHandle`: WebAuthn user handle/identifier
- `options.counter`: Optional counter for multiple keys (default: 0)

### `isP256DeterministicRequest()`

Utility function to check if options are for deterministic P-256 generation.

```typescript
function isP256DeterministicRequest(options: BIP39WalletCreateKeyOptions): boolean
```

### Types

```typescript
interface DeterministicP256Options {
  mnemonic: string
  origin: string
  userHandle: string
  counter?: number
}

interface BIP39WalletCreateKeyOptions extends WalletCreateKeyOptions {
  p256Options?: DeterministicP256Options
}
```

## Integration with Rocca Wallet

For integrating with the Rocca wallet (React Native), wrap your existing wallet implementation:

```typescript
// In your existing wallet setup
import { enhancedCreateKey } from '@credo-ts/core'

class RoccaWallet {
  constructor(private baseWallet: Wallet) {}

  async createKey(options: BIP39WalletCreateKeyOptions) {
    return enhancedCreateKey(
      this.baseWallet.createKey.bind(this.baseWallet), 
      options
    )
  }

  // ... delegate other methods to baseWallet
}

// Use the enhanced wallet
const baseWallet = new YourExistingWallet()
const wallet = new RoccaWallet(baseWallet)

// Now supports P-256 passkeys!
const passkey = await wallet.createKey({
  keyType: KeyType.P256,
  p256Options: {
    mnemonic: storedMnemonic,
    origin: 'your-app.com',
    userHandle: userId
  }
})
```

## Security Considerations

1. **Mnemonic Storage**: Store mnemonic phrases securely using platform-specific secure storage
2. **Domain Validation**: Ensure origin values match actual domains for security
3. **User Handle Privacy**: Consider using hashed or pseudonymous user handles
4. **Counter Management**: Track counters to avoid key collisions

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern="bip39"
```

The module includes comprehensive tests covering:
- ✅ Deterministic key generation
- ✅ dp256 library integration
- ✅ Error handling
- ✅ Delegation patterns
- ✅ Edge cases and type safety

## Compatibility

- **Credo-TS**: v0.5.17
- **React Native**: Compatible
- **Node.js**: Compatible
- **WebAuthn/FIDO2**: Compatible passkey format

## Migration from v0.6.0+

This implementation is specifically designed for Credo-TS v0.5.17. For newer versions, use the KMS-based approach in the main branch.