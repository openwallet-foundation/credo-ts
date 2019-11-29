import indy from 'indy-sdk';
import { Message } from './types';

export async function sign(wh: WalletHandle, message: Message, field: string, signer: Verkey): Promise<Message> {
  const { [field]: data, ...originalMessage } = message;

  const dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
  const signatureBuffer = await indy.cryptoSign(wh, signer, dataBuffer);

  const signedMessage = {
    // TypeScript is not able to infer mandatory type and id attribute, so we have to write it specifically.
    '@type': message['@type'],
    '@id': message['@id'],
    ...originalMessage,
    [`${field}~sig`]: {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
      signature: signatureBuffer.toString('base64'),
      sig_data: dataBuffer.toString('base64'),
      signers: signer,
    },
  };

  return signedMessage;
}
