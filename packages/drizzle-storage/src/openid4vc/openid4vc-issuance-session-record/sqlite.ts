import type {
  OpenId4VcIssuanceSessionAuthorization,
  OpenId4VcIssuanceSessionDpop,
  OpenId4VcIssuanceSessionPresentation,
  OpenId4VcIssuanceSessionRecord,
  OpenId4VcIssuanceSessionRecordTransaction,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionWalletAttestation,
  OpenId4VciCredentialOfferPayload,
} from '@credo-ts/openid4vc'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { openid4vcIssuer } from '../openid4vc-issuer-record/sqlite'

export const openId4VcIssuanceSession = sqliteTable(
  'OpenId4VcIssuanceSession',
  {
    ...getSqliteBaseRecordTable(),

    issuerId: text('issuer_id')
      .notNull()
      .references(() => openid4vcIssuer.issuerId, { onDelete: 'cascade' }),

    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),

    state: text().$type<OpenId4VcIssuanceSessionState>().notNull(),
    issuedCredentials: text('issued_credentials', { mode: 'json' }).$type<string[]>(),

    // Pre-authorized flow
    preAuthorizedCode: text('pre_authorized_code'),
    userPin: text('user_pin'),

    // Client and authentication
    clientId: text('client_id'),

    pkce: text({ mode: 'json' }).$type<NonNullable<OpenId4VcIssuanceSessionRecord['pkce']>>(),
    walletAttestation: text('wallet_attestation', { mode: 'json' }).$type<OpenId4VcIssuanceSessionWalletAttestation>(),
    dpop: text({ mode: 'json' }).$type<OpenId4VcIssuanceSessionDpop>(),
    authorization: text({ mode: 'json' }).$type<
      Omit<OpenId4VcIssuanceSessionAuthorization, 'codeExpiresAt'> & { codeExpiresAt?: string }
    >(),
    presentation: text({ mode: 'json' }).$type<OpenId4VcIssuanceSessionPresentation>(),

    // Metadata and error handling
    issuanceMetadata: text('issuance_metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

    transactions: text({ mode: 'json' }).$type<OpenId4VcIssuanceSessionRecordTransaction[]>(),

    // Credential offer
    credentialOfferUri: text('credential_offer_uri'),
    credentialOfferId: text('credential_offer_id'),
    credentialOfferPayload: text('credential_offer_payload', { mode: 'json' })
      .$type<OpenId4VciCredentialOfferPayload>()
      .notNull(),

    generateRefreshTokens: integer('generate_refresh_tokens', { mode: 'boolean' }),

    errorMessage: text('error_message'),
  },
  (table) => sqliteBaseRecordIndexes(table, 'openId4VcIssuanceSession')
)
