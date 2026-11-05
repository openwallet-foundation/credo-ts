import type { AgentContext } from '@credo-ts/core'
import { CredoError, JsonEncoder, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'
import { SignatureDecorator } from './SignatureDecorator'

// Spec'd as base64url, but ACA-Py pads it and older agents emit standard base64, so
// accept both, as `DidCommAttachment.getDataAsUint8Array` does.
const decodeSignatureField = (value: string, field: string): Uint8Array => {
  try {
    return TypedArrayEncoder.fromBase64Url(value.replace(/=+$/, ''))
  } catch (base64UrlError) {
    try {
      return TypedArrayEncoder.fromBase64(value)
    } catch {
      throw new CredoError(`Could not decode signature decorator ${field} as base64url or base64 string.`, {
        cause: base64UrlError,
      })
    }
  }
}

/**
 *
 * Unpack and verify signed data before casting it to the supplied type.
 *
 */
export async function unpackAndVerifySignatureDecorator(
  agentContext: AgentContext,
  decorator: SignatureDecorator
): Promise<Record<string, unknown>> {
  try {
    const signerVerkey = decorator.signer
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const publicJwk = Kms.PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: TypedArrayEncoder.fromBase58(signerVerkey),
    })

    // first 8 bytes are for 64 bit integer from unix epoch
    const signedData = decodeSignatureField(decorator.signatureData, 'signatureData')
    const signature = decodeSignatureField(decorator.signature, 'signature')

    const result = await kms.verify({
      algorithm: 'EdDSA',
      data: signedData,
      key: {
        publicJwk: publicJwk.toJson(),
      },
      signature,
    })

    if (!result.verified) {
      throw new CredoError('Could not verify signature')
    }

    return JsonEncoder.fromUint8Array(signedData.slice(8))
  } catch (error) {
    throw new CredoError('Signature is not valid', { cause: error })
  }
}

/**
 *
 * Sign data supplied and return a signature decorator.
 *
 */
export async function signData(
  agentContext: AgentContext,
  data: unknown,
  signerKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
): Promise<SignatureDecorator> {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  const dataBuffer = TypedArrayEncoder.concat([utils.timestamp(), JsonEncoder.toUint8Array(data)])

  const result = await kms.sign({ data: dataBuffer, algorithm: 'EdDSA', keyId: signerKey.keyId })

  const signatureDecorator = new SignatureDecorator({
    signatureType: 'https://didcomm.org/signature/1.0/ed25519Sha512_single',
    signature: TypedArrayEncoder.toBase64Url(result.signature),
    signatureData: TypedArrayEncoder.toBase64Url(dataBuffer),
    signer: TypedArrayEncoder.toBase58(signerKey.publicKey.publicKey),
  })

  return signatureDecorator
}
