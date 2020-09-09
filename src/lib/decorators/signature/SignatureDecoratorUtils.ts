import base64url from 'base64url';

import { SignatureDecorator } from './SignatureDecorator';
import timestamp from '../../utils/timestamp';
import { Wallet } from '../../wallet/Wallet';

/**
 * Unpack and verify signed data before casting it to the supplied type.
 *
 * @param decorator Signature decorator to unpack and verify
 * @param wallet wallet instance
 *
 * @return Resulting data
 */
export async function unpackAndVerifySignatureDecorator(
  decorator: SignatureDecorator,
  wallet: Wallet
): Promise<unknown> {
  const signerVerkey = decorator.signer;

  // first 8 bytes are for 64 bit integer from unix epoch
  const signedData = base64url.toBuffer(decorator.signatureData);
  const signature = base64url.toBuffer(decorator.signature);

  const isValid = await wallet.verify(signerVerkey, signedData, signature);

  if (!isValid) {
    throw new Error('Signature is not valid!');
  }

  // TODO: return Connection instance instead of raw json
  return JSON.parse(signedData.slice(8).toString('utf-8'));
}

/**
 * Sign data supplied and return a signature decorator.
 *
 * @param data the data to sign
 * @param walletHandle the handle of the wallet to use for signing
 * @param signerKey Signers verkey
 * @param indy Indy instance
 *
 * @returns Resulting signature decorator.
 */
export async function signData(data: unknown, wallet: Wallet, signerKey: Verkey): Promise<SignatureDecorator> {
  const dataBuffer = Buffer.concat([timestamp(), Buffer.from(JSON.stringify(data), 'utf8')]);

  const signatureBuffer = await wallet.sign(dataBuffer, signerKey);

  const signatureDecorator = new SignatureDecorator({
    signatureType: 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/signature/1.0/ed25519Sha512_single',
    signature: base64url.encode(signatureBuffer),
    signatureData: base64url.encode(dataBuffer),
    signer: signerKey,
  });

  return signatureDecorator;
}
