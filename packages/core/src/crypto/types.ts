export enum KeyType {
  Ed25519 = 'Ed25519',
  Secp256k1 = 'Secp256k1',
  X25519 = 'X25519',
  Bls12381g1g2 = 'bls12381g1g2',
  Bls12381g1 = 'bls12381g1',
  Bls12381g2 = 'bls12381g2',
}

export const defaultKeyType = KeyType.Ed25519

export enum KeyRepresentationType {
  Base58 = 'Base58',
  Base64 = 'Base64',
  JWK = 'JWK',
  Multibase = 'Multibase',
  Hex = 'Hex',
  Pem = 'Pem',
  BlockchainAccountId = 'BlockchainAccountId',
  EthereumAddress = 'EthereumAddress',
}

export type KeyPair = {
  privateKey: Uint8Array
  publicKey: Uint8Array
}
