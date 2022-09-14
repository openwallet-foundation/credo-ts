import type { EncryptedMessage } from '../agent/didcomm'
import { DidDocument } from '../../../peer-did-ts/src/did-doc/DidDocument'
import { DecryptedMessageContext } from '../../src/agent/didcomm/types'
import { isDid } from './did'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidJweStructure(message: any): message is EncryptedMessage {
  return message && typeof message === 'object' && message.protected && message.iv && message.ciphertext && message.tag
}

export function didFromKid(decryptedMessageContext: DecryptedMessageContext): string | undefined {
  const kid = decryptedMessageContext.recipient
  if (!kid) return undefined

  const did = DidDocument.extractDidFromKid(kid)
  return isDid(did) ? did : undefined
}
