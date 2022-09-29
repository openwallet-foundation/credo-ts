import type { KeyDidMapping } from './keyDidMapping'

import { DidDocumentBuilder } from '../did-doc'
import { VerificationMethod } from '../verificationMethod'

import { Key } from './key'
import { KeyType } from './key-type'

const VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019 = 'X25519KeyAgreementKey2019'

export function getX25519VerificationMethod({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
    controller,
    publicKeyBase58: key.publicKeyBase58,
  })
}

export function getX25519DidDoc(did: string, key: Key) {
  const verificationMethod = getX25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did })

  const document = new DidDocumentBuilder(did).addKeyAgreement(verificationMethod).build()

  return document
}

export const keyDidX25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019],

  getDidDocument: getX25519DidDoc,
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
