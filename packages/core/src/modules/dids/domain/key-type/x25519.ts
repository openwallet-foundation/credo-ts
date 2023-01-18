import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'

const VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019 = 'X25519KeyAgreementKey2019'

export function getX25519VerificationMethod({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return {
    id,
    type: VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
    controller,
    publicKeyBase58: key.publicKeyBase58,
  }
}

export const keyDidX25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019],

  getVerificationMethods: (did, key) => [
    getX25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (
      verificationMethod.type !== VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019 ||
      !verificationMethod.publicKeyBase58
    ) {
      throw new Error('Invalid verification method passed')
    }

    return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.X25519)
  },
}
