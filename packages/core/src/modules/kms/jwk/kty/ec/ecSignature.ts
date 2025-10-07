import { ECDSASigValue } from '@peculiar/asn1-ecc'
import { AsnConvert } from '@peculiar/asn1-schema'
import { KeyManagementError } from '../../../error/KeyManagementError'
import type { KmsJwkPublicEc } from './ecJwk'
import { ecCrvToCurveParams } from './ecPublicKey'

/**
 * Converts a RAW EC signature to DER format
 *
 * @param rawSignature - Raw signature as r || s concatenated values
 * @param crv - The EC crv of the key used for the signature
 * @returns DER encoded signature
 */
export function rawEcSignatureToDer(rawSignature: Uint8Array, crv: KmsJwkPublicEc['crv']): Uint8Array {
  const pointBitLength = ecCrvToCurveParams[crv].pointBitLength
  const pointByteLength = Math.ceil(pointBitLength / 8)

  if (rawSignature.length !== pointByteLength * 2) {
    throw new KeyManagementError(
      `Invalid raw signature length for EC signature conversion. Expected ${pointByteLength * 2} bytes for crv ${crv}`
    )
  }

  // Extract r and s values from the raw signature
  const r = rawSignature.slice(0, pointByteLength)
  const s = rawSignature.slice(pointByteLength)

  // Remove leading zeros that aren't necessary for ASN.1 encoding
  const rValue = removeLeadingZeros(r)
  const sValue = removeLeadingZeros(s)

  // Create the EcDsaSignature object
  const signature = new ECDSASigValue()
  signature.r = new Uint8Array(ensurePositive(rValue))
  signature.s = new Uint8Array(ensurePositive(sValue))

  // Convert to DER
  return new Uint8Array(AsnConvert.serialize(signature))
}

/**
 * Converts a DER encoded EC signature to RAW format
 *
 * @param derSignature - DER encoded signature
 * @param crv - The EC crv of the key used for the signature
 * @returns Raw signature as r || s concatenated values
 */
export function derEcSignatureToRaw(derSignature: Uint8Array, crv: KmsJwkPublicEc['crv']): Uint8Array {
  // Parse DER signature
  const asn = AsnConvert.parse(derSignature, ECDSASigValue)

  const pointBitLength = ecCrvToCurveParams[crv].pointBitLength
  const pointByteLength = Math.ceil(pointBitLength / 8)

  // Ensure r and s are padded to the correct point size
  const rPadded = padToLength(new Uint8Array(asn.r), pointByteLength)
  const sPadded = padToLength(new Uint8Array(asn.s), pointByteLength)

  // Concatenate to form raw signature
  const rawSignature = new Uint8Array(pointByteLength * 2)
  rawSignature.set(rPadded, 0)
  rawSignature.set(sPadded, pointByteLength)

  return rawSignature
}

/**
 * Helper function to remove unnecessary leading zeros from an integer representation
 *
 * @param data - The integer bytes
 * @returns - Data with leading zeros removed
 */
function removeLeadingZeros(data: Uint8Array): Uint8Array {
  let startIndex = 0
  while (startIndex < data.length - 1 && data[startIndex] === 0) {
    startIndex++
  }

  return data.slice(startIndex)
}

/**
 * Ensures an integer value is represented as positive in ASN.1 by
 * adding a leading zero if the high bit is set
 *
 * @param data - The integer bytes
 * @returns Data ensuring positive integer representation
 */
function ensurePositive(data: Uint8Array): Uint8Array {
  // If high bit is set, prepend a zero byte to ensure it's treated as positive
  if (data.length > 0 && (data[0] & 0x80) !== 0) {
    const result = new Uint8Array(data.length + 1)
    result.set(data, 1)
    return result
  }
  return data
}

/**
 * Pads an integer value to the specified length
 *
 * @param data - The integer bytes
 * @param targetLength - The desired length
 * @returns Padded data
 */
function padToLength(data: Uint8Array, targetLength: number) {
  if (data.length === targetLength) {
    return data
  }

  if (data.length > targetLength) {
    // If the value is larger, ensure we're not losing significant bytes
    const significantStart = data.length - targetLength
    for (let i = 0; i < significantStart; i++) {
      if (data[i] !== 0) {
        throw new KeyManagementError('Value too large for the specified point size')
      }
    }
    return data.slice(significantStart)
  }

  // Pad with leading zeros
  const result = new Uint8Array(targetLength)
  result.set(data, targetLength - data.length)
  return result
}
