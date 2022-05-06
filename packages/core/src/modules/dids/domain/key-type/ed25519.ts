import type { VerificationMethod } from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'

import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'
import { ED25519_SUITE_CONTEXT_URL_2018 } from '../../../../crypto/signature-suites/ed25519/constants'
import { SECURITY_X25519_CONTEXT_URL } from '../../../vc/constants'

import { getSignatureKeyBase } from './getSignatureKeyBase'
import { getX25519VerificationMethod } from './x25519'

const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 = 'Ed25519VerificationKey2018'

export function getEd25519VerificationMethod({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return {
    id,
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    controller,
    publicKeyBase58: key.publicKeyBase58,
  }
}

export function getEd25519DidDoc(did: string, key: Key) {
  const verificationMethod = getEd25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did })

  const publicKeyX25519 = convertPublicKeyToX25519(key.publicKey)
  const didKeyX25519 = Key.fromPublicKey(publicKeyX25519, KeyType.X25519)
  const x25519VerificationMethod = getX25519VerificationMethod({
    id: `${did}#${didKeyX25519.fingerprint}`,
    key: didKeyX25519,
    controller: did,
  })

  const didDocBuilder = getSignatureKeyBase({ did, key, verificationMethod })

  didDocBuilder
    .addContext(ED25519_SUITE_CONTEXT_URL_2018)
    .addContext(SECURITY_X25519_CONTEXT_URL)
    .addKeyAgreement(x25519VerificationMethod)

  return didDocBuilder.build()
}

export const keyDidEd25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018],
  getDidDocument: getEd25519DidDoc,
  getVerificationMethods: (did, key) => [
    getEd25519VerificationMethod({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (
      verificationMethod.type !== VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 ||
      !verificationMethod.publicKeyBase58
    ) {
      throw new Error('Invalid verification method passed')
    }

    return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Ed25519)
  },
}

export { convertPublicKeyToX25519 }
