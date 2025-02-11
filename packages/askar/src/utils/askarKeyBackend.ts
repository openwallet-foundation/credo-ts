import { KeyBackend as CredoKeyBackend } from '@credo-ts/core'
import { KeyBackend as AskarKeyBackend } from '@openwallet-foundation/askar-shared'

export const convertToAskarKeyBackend = (credoKeyBackend: CredoKeyBackend) => {
  switch (credoKeyBackend) {
    case CredoKeyBackend.Software:
      return AskarKeyBackend.Software
    case CredoKeyBackend.SecureElement:
      return AskarKeyBackend.SecureElement
  }
}
