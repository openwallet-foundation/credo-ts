import type { AgentContext } from '@credo-ts/core'

import { Buffer, CredoError, JsonEncoder, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'

import { SignatureDecorator } from './SignatureDecorator'

/**
 * Unpack and verify signed data before casting it to the supplied type.
 *
 * @param decorator Signature decorator to unpack and verify
 * @param wallet wallet instance
 *
 * @return Resulting data
 */
export async function unpackAndVerifySignatureDecorator(
  agentContext: AgentContext,
  decorator: SignatureDecorator
): Promise<Record<string, unknown>> {
  const signerVerkey = decorator.signer
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

  const publicJwk = Kms.PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: TypedArrayEncoder.fromBase58(signerVerkey),
  })

  // first 8 bytes are for 64 bit integer from unix epoch
  const signedData = TypedArrayEncoder.fromBase64(decorator.signatureData)
  const signature = TypedArrayEncoder.fromBase64(decorator.signature)

  const result = await kms.verify({
    algorithm: 'EdDSA',
    data: signedData,
    key: {
      publicJwk: publicJwk.toJson(),
    },
    signature,
  })

  if (!result.verified) {
    throw new CredoError('Signature is not valid')
  }

  return JsonEncoder.fromBuffer(signedData.slice(8))
}

/**
 * Sign data supplied and return a signature decorator.
 *
 * @param data the data to sign
 * @param wallet the wallet containing a key to use for signing
 * @param signerKey signer key
 *
 * @returns Resulting signature decorator.
 */
export async function signData(
  agentContext: AgentContext,
  data: unknown,
  signerKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
): Promise<SignatureDecorator> {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  const dataBuffer = Buffer.concat([utils.timestamp(), JsonEncoder.toBuffer(data)])

  const result = await kms.sign({ data: dataBuffer, algorithm: 'EdDSA', keyId: signerKey.keyId })

  const signatureDecorator = new SignatureDecorator({
    signatureType: 'https://didcomm.org/signature/1.0/ed25519Sha512_single',
    signature: TypedArrayEncoder.toBase64URL(result.signature),
    signatureData: TypedArrayEncoder.toBase64URL(dataBuffer),
    signer: TypedArrayEncoder.toBase58(signerKey.publicKey.publicKey),
  })

  return signatureDecorator
}
