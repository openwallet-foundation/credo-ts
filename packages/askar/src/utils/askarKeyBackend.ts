import { KeyBackend as CredoKeyBackend } from '@credo-ts/core'
import { KeyBackend as AskarKeyBackend } from '@hyperledger/aries-askar-shared'

export const convertToAskarKeyBackend = (credoKeyBackend: CredoKeyBackend) => {
  switch (credoKeyBackend) {
    case CredoKeyBackend.Software:
      return AskarKeyBackend.Software
    case CredoKeyBackend.SecureElement:
      return AskarKeyBackend.SecureElement
  }
}
