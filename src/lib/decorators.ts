import base64url from 'base64url';
import { Message } from './types';
import timestamp from './timestamp';

export async function sign(
  wh: WalletHandle,
  message: Message,
  field: string,
  signer: Verkey,
  indy: Indy
): Promise<Message> {
  const { [field]: data, ...originalMessage } = message;

  const dataBuffer = Buffer.concat([timestamp(), Buffer.from(JSON.stringify(data), 'utf8')]);
  const signatureBuffer = await indy.cryptoSign(wh, signer, dataBuffer);

  const signedMessage = {
    // TypeScript is not able to infer mandatory type and id attribute, so we have to write it specifically.
    '@type': message['@type'],
    '@id': message['@id'],
    ...originalMessage,
    [`${field}~sig`]: {
      '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
      signature: base64url.encode(signatureBuffer),
      sig_data: base64url.encode(dataBuffer),
      signer: signer,
    },
  };

  return signedMessage;
}

export async function verify(message: Message, field: string, indy: Indy) {
  const { [`${field}~sig`]: data, ...signedMessage } = message;

  const signerVerkey = data.signer;
  // first 8 bytes are for 64 bit integer from unix epoch
  const signedData = base64url.toBuffer(data.sig_data);
  const signature = base64url.toBuffer(data.signature);

  // check signature
  const valid = await indy.cryptoVerify(signerVerkey, signedData, signature);

  if (!valid) {
    throw new Error('Signature is not valid!');
  }

  const originalMessage = {
    // TypeScript is not able to infer mandatory type and id attribute, so we have to write it specifically.
    '@type': message['@type'],
    '@id': message['@id'],
    ...signedMessage,
    [`${field}`]: JSON.parse(signedData.slice(8).toString('utf-8')),
  };

  return originalMessage;
}
