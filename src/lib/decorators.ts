import indy from 'indy-sdk';
import { Message } from './types';

// Question: Spec isn't clear about the endianness. Assumes big-endian here
// since ACA-Py uses big-endian
function timestamp(isTest: boolean): Uint8Array {
  if (isTest) {
    return Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0);
  }

  let time = Date.now();
  const bytes = [];
  for (let i = 0; i < 8; i++) {
    const byte = time & 0xff;
    bytes.push(byte);
    time = (time - byte) / 256; // Javascript right shift (>>>) only works on 32 bit integers
  }
  return Uint8Array.from(bytes).reverse();
}

export async function sign(
  wh: WalletHandle,
  message: Message,
  field: string,
  signer: Verkey,
  isTest: boolean = false
): Promise<Message> {
  const { [field]: data, ...originalMessage } = message;

  const dataBuffer = Buffer.concat([timestamp(isTest), Buffer.from(JSON.stringify(data), 'utf8')]);
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
      signer: signer,
    },
  };

  return signedMessage;
}

export async function verify(message: Message, field: string) {
  const { [`${field}~sig`]: data, ...signedMessage } = message;

  const signerVerkey = data.signer;
  // first 8 bytes are for 64 bit integer from unix epoch
  const signedData = Buffer.from(data.sig_data, 'base64');
  const signature = Buffer.from(data.signature, 'base64');

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
