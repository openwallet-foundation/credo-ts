import { DidDocument, getKeyFromVerificationMethod, Key } from '@credo-ts/core'
import { PublicKey } from '@hashgraph/sdk'
import { DID_ROOT_KEY_ID, JsonLdDIDDocument, KeysUtility } from '@hiero-did-sdk/core'

export function hederaPublicKeyFromCredoKey(key: Key): PublicKey {
  return KeysUtility.fromBytes(key.publicKey).toPublicKey()
}

export function getRootKeyForHederaDid(didDocument: DidDocument | JsonLdDIDDocument): Key {
  const rootVerificationMethod = didDocument.verificationMethod?.find((verificationMethod) =>
    verificationMethod.id.endsWith(DID_ROOT_KEY_ID)
  )

  const rootKey = rootVerificationMethod ? getKeyFromVerificationMethod(rootVerificationMethod) : null
  if (!rootKey) {
    throw new Error('The root key is not found in DID document')
  }

  return rootKey
}
