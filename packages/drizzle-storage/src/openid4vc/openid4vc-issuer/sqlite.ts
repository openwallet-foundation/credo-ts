import { Kms } from '@credo-ts/core'
import {
  OpenId4VciAuthorizationServerConfig,
  OpenId4VciBatchCredentialIssuanceOptions,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadataDisplay,
} from '@credo-ts/openid4vc'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const openid4vcIssuer = sqliteTable(
  'Openid4vcIssuer',
  {
    ...getSqliteBaseRecordTable(),

    // NOTE: generally we don't have unique constraints on single fields,
    // (always in combination with the context correlation id), but for issuer
    // id, it will actually cause issues, since we use the issuerId in the public
    // url and map that to the context correlation id.
    issuerId: text('issuer_id').notNull().unique(),

    accessTokenPublicKeyFingerprint: text('access_token_public_key_fingerprint', {
      mode: 'json',
    }),
    accessTokenPublicJwk: text('access_token_public_jwk', { mode: 'json' }).$type<Kms.KmsJwkPublicAsymmetric>(),

    credentialConfigurationsSupported: text('credential_configurations_supported', { mode: 'json' })
      .$type<OpenId4VciCredentialConfigurationsSupportedWithFormats>()
      .notNull(),
    display: text({ mode: 'json' }).$type<OpenId4VciCredentialIssuerMetadataDisplay[]>(),
    authorizationServerConfigs: text('authorization_server_configs', { mode: 'json' }).$type<
      OpenId4VciAuthorizationServerConfig[]
    >(),
    dpopSigningAlgValuesSupported: text('dpop_signing_alg_values_supported', { mode: 'json' }).$type<
      [Kms.KnownJwaSignatureAlgorithm, ...Kms.KnownJwaSignatureAlgorithm[]]
    >(),
    batchCredentialIssuance: text('batch_credential_issuance').$type<OpenId4VciBatchCredentialIssuanceOptions>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'openid4vcIssuer')
)
