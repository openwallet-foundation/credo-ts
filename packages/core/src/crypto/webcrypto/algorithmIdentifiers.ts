import { ecdsaWithSHA256 } from '@peculiar/asn1-ecc'
import { AsnProp, AsnPropTypes, AsnSerializer } from '@peculiar/asn1-schema'
import { AlgorithmIdentifier } from '@peculiar/asn1-x509'

/**
 *
 * https://oid-rep.orange-labs.fr/get/1.2.840.10045.3.1.7
 *
 */
class P256AlgorithmIdentifierParameters {
  @AsnProp({ type: AsnPropTypes.ObjectIdentifier })
  public parameters: string = '1.2.840.10045.3.1.7'
}

/**
 *
 * https://oid-rep.orange-labs.fr/get/1.3.132.0.34
 *
 */
class P384AlgorithmIdentifierParameters {
  @AsnProp({ type: AsnPropTypes.ObjectIdentifier })
  public parameters: string = '1.3.132.0.34'
}

/**
 *
 * https://oid-rep.orange-labs.fr/get/1.3.132.0.10
 *
 */
class K256AlgorithmIdentifierParameters {
  @AsnProp({ type: AsnPropTypes.ObjectIdentifier })
  public parameters: string = '1.3.132.0.10'
}

export const ecdsaWithSha256AndP256AlgorithmIdentifier = new AlgorithmIdentifier({
  algorithm: ecdsaWithSHA256.algorithm,
  parameters: AsnSerializer.serialize(new P256AlgorithmIdentifierParameters()),
})

export const ecdsaWithSha256AndK256AlgorithmIdentifier = new AlgorithmIdentifier({
  algorithm: ecdsaWithSHA256.algorithm,
  parameters: AsnSerializer.serialize(new K256AlgorithmIdentifierParameters()),
})

export const ecdsaWithSha256AndP384AlgorithmIdentifier = new AlgorithmIdentifier({
  algorithm: ecdsaWithSHA256.algorithm,
  parameters: AsnSerializer.serialize(new P384AlgorithmIdentifierParameters()),
})

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
