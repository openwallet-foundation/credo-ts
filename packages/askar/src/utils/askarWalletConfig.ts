import type { WalletConfig } from '@aries-framework/core'

import { KeyDerivationMethod, WalletError } from '@aries-framework/core'
import { StoreKeyMethod } from 'aries-askar-test-shared'

export const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod?: KeyDerivationMethod) => {
  if (!keyDerivationMethod) {
    return undefined
  }

  const correspondanceTable = {
    [KeyDerivationMethod.Raw]: StoreKeyMethod.Raw,
    [KeyDerivationMethod.Argon2IInt]: `${StoreKeyMethod.Kdf}:argon2i:int`,
    [KeyDerivationMethod.Argon2IMod]: `${StoreKeyMethod.Kdf}:argon2i:mod`,
  }

  return correspondanceTable[keyDerivationMethod] as StoreKeyMethod
}

export const uriFromWalletConfig = (walletConfig: WalletConfig, basePath: string): { uri: string; path?: string } => {
  let uri = ''
  let path

  // By default use sqlite as database backend
  if (!walletConfig.storage) {
    walletConfig.storage = { type: 'sqlite' }
  }

  if (walletConfig.storage.type === 'sqlite') {
    if (walletConfig.storage.inMemory) {
      uri = 'sqlite://:memory:'
    } else {
      path = `${(walletConfig.storage.path as string) ?? basePath + '/wallet'}/${walletConfig.id}/sqlite.db`
      uri = `sqlite://${path}`
    }
  } else {
    // TODO posgres
    throw new WalletError(`Storage type not supported: ${walletConfig.storage.type}`)
  }

  return { uri, path }
}
