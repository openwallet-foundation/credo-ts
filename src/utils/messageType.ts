import { UnpackedMessage } from '../types';

export function replaceLegacyDidSovPrefix(message: UnpackedMessage) {
  const didSovPrefix = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec';
  const didCommPrefix = 'https://didcomm.org';
  const messageType = message['@type'];

  if (messageType.startsWith(didSovPrefix)) {
    message['@type'] = messageType.replace(didSovPrefix, didCommPrefix);
  }
}
