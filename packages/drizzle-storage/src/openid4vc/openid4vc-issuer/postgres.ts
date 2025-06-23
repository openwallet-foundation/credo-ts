import { Kms } from '@credo-ts/core'
import {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciBatchCredentialIssuanceOptions,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
} from '@credo-ts/openid4vc'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const openid4vcIssuer = pgTable(
  'Openid4vcIssuer',
  {
    ...getPostgresBaseRecordTable(),

    issuerId: text('issuer_id').unique().notNull(),
    accessTokenPublicKeyFingerprint: jsonb('access_token_public_key_fingerprint'),
    accessTokenPublicJwk: jsonb('access_token_public_jwk').$type<Kms.KmsJwkPublicAsymmetric>(),

    credentialConfigurationsSupported: jsonb('credential_configurations_supported')
      .$type<OpenId4VciCredentialConfigurationsSupportedWithFormats>()
      .notNull(),
    display: jsonb().$type<OpenId4VciCredentialIssuerMetadataDisplay[]>(),
    authorizationServerConfigs: jsonb('authorization_server_configs').$type<OpenId4VciAuthorizationServerConfig[]>(),
    dpopSigningAlgValuesSupported: jsonb('dpop_signing_alg_values_supported').$type<
      [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]
    >(),
    batchCredentialIssuance: text('batch_credential_issuance').$type<OpenId4VciBatchCredentialIssuanceOptions>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'openid4vcIssuer')
)
