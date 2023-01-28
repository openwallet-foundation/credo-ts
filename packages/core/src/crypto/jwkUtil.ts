import { AriesFrameworkError } from "../error"
import { TypedArrayEncoder } from "../utils/TypedArrayEncoder"
import { Key } from "./Key"
import { KeyType } from "./KeyType"



export const createJwkFromKey = (key: Key): Jwk => {
    if (key.keyType !== KeyType.Ed25519) {
        throw new AriesFrameworkError(`JWK creation is only supported for Ed25519 key types. Received ${key.keyType}`)
    }

    return {
        kty: 'OKP',
        crv: 'Ed25519',
        x: TypedArrayEncoder.toBase64URL(key.publicKey),
    }
}

export const createKeyFromJwk = (jwk: Jwk): Key => {
    if (jwk.crv !== 'Ed25519') {
        throw new AriesFrameworkError('Only JWKs with Ed25519 key type is supported.')
    }
    return Key.fromPublicKeyBase58(TypedArrayEncoder.toBase58(TypedArrayEncoder.fromBase64(jwk.x)), KeyType.Ed25519)
}

export interface Jwk {
  kty: "EC" | "OKP"
  crv: "Ed25519" | "X25519" | "P-256" | "P-384" | "secp256k1"
  x: string
  y?: string
}
