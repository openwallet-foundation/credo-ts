import {
  OpenId4VcIssuanceSessionAuthorization,
  OpenId4VcIssuanceSessionDpop,
  OpenId4VcIssuanceSessionPkce,
  OpenId4VcIssuanceSessionPresentation,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionWalletAttestation,
  OpenId4VciCredentialOfferPayload,
} from '@credo-ts/openid4vc'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { openid4vcIssuer } from '../postgres'

export const openId4VcIssuanceSessionStateEnum = pgEnum('OpenId4VcIssuanceSessionState', OpenId4VcIssuanceSessionState)

export const openId4VcIssuanceSession = pgTable(
  'OpenId4VcIssuanceSession',
  {
    ...postgresBaseRecordTable,

    issuerId: text('issuer_id')
      .notNull()
      .references(() => openid4vcIssuer.issuerId, { onDelete: 'cascade' }),

    state: openId4VcIssuanceSessionStateEnum().notNull(),
    issuedCredentials: text('issued_credentials').array(),

    // Pre-authorized flow
    preAuthorizedCode: text('pre_authorized_code'),
    userPin: text('user_pin'),

    // Client and authentication
    clientId: text('client_id'),

    pkce: jsonb().$type<OpenId4VcIssuanceSessionPkce>(),
    walletAttestation: jsonb('wallet_attestation').$type<OpenId4VcIssuanceSessionWalletAttestation>(),
    dpop: jsonb().$type<OpenId4VcIssuanceSessionDpop>(),
    authorization: jsonb().$type<
      Omit<OpenId4VcIssuanceSessionAuthorization, 'codeExpiresAt'> & { codeExpiresAt?: string }
    >(),
    presentation: jsonb().$type<OpenId4VcIssuanceSessionPresentation>(),

    // Metadata and error handling
    issuanceMetadata: jsonb('issuance_metadata').$type<Record<string, unknown>>(),

    // Credential offer
    credentialOfferUri: text('credential_offer_uri'),
    credentialOfferId: text('credential_offer_id'),
    credentialOfferPayload: jsonb('credential_offer_payload').$type<OpenId4VciCredentialOfferPayload>().notNull(),

    errorMessage: text('error_message'),
  },
  (table) => postgresBaseRecordIndexes(table, 'openId4VcIssuanceSession')
)
