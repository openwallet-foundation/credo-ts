import { UnpackedMessage } from '../types'

export function replaceLegacyDidSovPrefixOnMessage(message: UnpackedMessage) {
  message['@type'] = replaceLegacyDidSovPrefix(message['@type'])
}

export function replaceLegacyDidSovPrefix(messageType: string) {
  const didSovPrefix = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec'
  const didCommPrefix = 'https://didcomm.org'

  if (messageType.startsWith(didSovPrefix)) {
    return messageType.replace(didSovPrefix, didCommPrefix)
  }

  return messageType
}
