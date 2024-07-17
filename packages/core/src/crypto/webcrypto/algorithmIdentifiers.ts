import { id_ecPublicKey, id_secp256r1, id_secp384r1 } from '@peculiar/asn1-ecc'
import { AsnObjectIdentifierConverter } from '@peculiar/asn1-schema'
import { AlgorithmIdentifier } from '@peculiar/asn1-x509'

const ecPublicKeyAlgorithmIdentifier = (objectId: string) =>
  new AlgorithmIdentifier({
    algorithm: id_ecPublicKey,
    parameters: AsnObjectIdentifierConverter.toASN(objectId).toBER(),
  })

/**
 *
 * https://oid-rep.orange-labs.fr/get/1.2.840.10045.3.1.7
 *
 */
export const ecPublicKeyWithP256AlgorithmIdentifier = ecPublicKeyAlgorithmIdentifier(id_secp256r1)
/**
 *
 * https://oid-rep.orange-labs.fr/get/1.3.132.0.34
 *
 */
export const ecPublicKeyWithP384AlgorithmIdentifier = ecPublicKeyAlgorithmIdentifier(id_secp384r1)
/**
 *
 * https://oid-rep.orange-labs.fr/get/1.3.132.0.10
 *
 */
export const ecPublicKeyWithK256AlgorithmIdentifier = ecPublicKeyAlgorithmIdentifier('1.3.132.0.10')

/**
 *
 * from: https://datatracker.ietf.org/doc/html/rfc8410#section-3
 *
 */
export const ed25519AlgorithmIdentifier = new AlgorithmIdentifier({ algorithm: '1.3.101.112' })

/**
 *
 * from: https://datatracker.ietf.org/doc/html/rfc8410#section-3
 *
 */
export const x25519AlgorithmIdentifier = new AlgorithmIdentifier({ algorithm: '1.3.101.110' })
