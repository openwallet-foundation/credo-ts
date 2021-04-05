import type { Verkey } from 'indy-sdk'
import { SignatureDecorator } from './SignatureDecorator'
import timestamp from '../../utils/timestamp'
import { Wallet } from '../../wallet/Wallet'
import { Buffer } from '../../utils/buffer'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { BufferEncoder } from '../../utils/BufferEncoder'

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
): Promise<Record<string, unknown>> {
  const signerVerkey = decorator.signer

  // first 8 bytes are for 64 bit integer from unix epoch
  const signedData = BufferEncoder.fromBase64(decorator.signatureData)
  const signature = BufferEncoder.fromBase64(decorator.signature)

  const isValid = await wallet.verify(signerVerkey, signedData, signature)

  if (!isValid) {
    throw new Error('Signature is not valid!')
  }

  // TODO: return Connection instance instead of raw json
  return JsonEncoder.fromBuffer(signedData.slice(8))
}

/**
 * Sign data supplied and return a signature decorator.
 *
 * @param data the data to sign
 * @param wallet the wallet contianing a key to use for signing
 * @param signerKey signers verkey
 *
 * @returns Resulting signature decorator.
 */
export async function signData(data: unknown, wallet: Wallet, signerKey: Verkey): Promise<SignatureDecorator> {
  const dataBuffer = Buffer.concat([timestamp(), JsonEncoder.toBuffer(data)])

  const signatureBuffer = await wallet.sign(dataBuffer, signerKey)

  const signatureDecorator = new SignatureDecorator({
    signatureType: 'https://didcomm.org/signature/1.0/ed25519Sha512_single',
    signature: BufferEncoder.toBase64URL(signatureBuffer),
    signatureData: BufferEncoder.toBase64URL(dataBuffer),
    signer: signerKey,
  })

  return signatureDecorator
}
