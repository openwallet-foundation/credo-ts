export enum JwaSignatureAlgorithm {
  HS256 = 'HS256',
  HS384 = 'HS384',
  HS512 = 'HS512',
  RS256 = 'RS256',
  RS384 = 'RS384',
  RS512 = 'RS512',
  ES256 = 'ES256',
  ES384 = 'ES384',
  ES512 = 'ES512',
  PS256 = 'PS256',
  PS384 = 'PS384',
  PS512 = 'PS512',
  EdDSA = 'EdDSA',
  none = 'none',
}

export enum JwaEncryptionAlgorithm {
  RSA1_5 = 'RSA1_5',
  RSA_OAEP = 'RSA-OAEP',
  RSA_OAEP_256 = 'RSA-OAEP-256',
  A128KW = 'A128KW',
  A192KW = 'A192KW',
  A256KW = 'A256KW',
  dir = 'dir',
  ECDH_ES = 'ECDH-ES',
  ECDH_ES_A128KW = 'ECDH-ES+A128KW',
  ECDH_ES_A192KW = 'ECDH-ES+A192KW',
  ECDH_ES_A256KW = 'ECDH-ES+A256KW',
  A128GCMKW = 'A128GCMKW',
  A192GCMKW = 'A192GCMKW',
  A256GCMKW = 'A256GCMKW',
  PBES2_HS256_A128KW = 'PBES2-HS256+A128KW',
  PBES2_HS384_A192KW = 'PBES2-HS384+A192KW',
  PBES2_HS512_A256KW = 'PBES2-HS512+A256KW',
}

export type JwaAlgorithm = JwaSignatureAlgorithm | JwaEncryptionAlgorithm
