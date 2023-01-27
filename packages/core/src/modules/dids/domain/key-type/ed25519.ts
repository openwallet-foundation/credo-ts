import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'

export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 = 'Ed25519VerificationKey2018'
export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020 = 'Ed25519VerificationKey2020'

export function getEd25519VerificationMethod({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return {
    id,
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    controller,
    publicKeyBase58: key.publicKeyBase58,
  }
}

export const keyDidEd25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  ],
  getVerificationMethods: (did, key) => [
    getEd25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (
      verificationMethod.type === VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 &&
      verificationMethod.publicKeyBase58
    ) {
      return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Ed25519)
    }
    if (
      verificationMethod.type === VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020 &&
      verificationMethod.publicKeyMultibase
    ) {
      return Key.fromFingerprint(verificationMethod.publicKeyMultibase)
    }

    throw new Error('Invalid verification method passed')
  },
}

export { convertPublicKeyToX25519 }
