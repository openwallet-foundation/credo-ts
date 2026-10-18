import {
  ActionMenu,
  ActionMenuRecord,
  ActionMenuRole,
  ActionMenuSelection,
  ActionMenuState,
} from '@credo-ts/action-menu'
import {
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionRecord,
  AnonCredsCredentialRecord,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsLinkSecretRecord,
  AnonCredsRevocationRegistryDefinitionPrivateRecord,
  AnonCredsRevocationRegistryDefinitionRecord,
  AnonCredsRevocationRegistryState,
  AnonCredsSchemaRecord,
} from '@credo-ts/anoncreds'
import {
  type AgentContext,
  type BaseRecordAny,
  DidDocument,
  DidDocumentRole,
  DidRecord,
  GenericRecord,
  getRecordPropertyNames,
  JsonTransformer,
  Kms,
  MdocRecord,
  MdocVerificationSessionRecord,
  MdocVerificationSessionState,
  SdJwtVcRecord,
  SingleContextLruCacheRecord,
  StorageVersionRecord,
  W3cCredentialRecord,
  W3cJsonLdVerifiableCredential,
  W3cV2CredentialRecord,
} from '@credo-ts/core'
import {
  DidCommBasicMessageRecord,
  DidCommBasicMessageRole,
  DidCommConnectionRecord,
  DidCommCredentialExchangeRecord,
  DidCommCredentialPreviewAttribute,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
  DidCommMediationRecord,
  DidCommMediationRole,
  DidCommMediationState,
  DidCommMediatorRoutingRecord,
  DidCommMessageRecord,
  DidCommMessageRole,
  DidCommOutOfBandInvitation,
  DidCommOutOfBandRecord,
  DidCommOutOfBandRole,
  DidCommOutOfBandState,
  DidCommProofExchangeRecord,
  DidCommProofRole,
  DidCommProofState,
  DidCommRevocationNotification,
} from '@credo-ts/didcomm'
import { DrpcRecord, DrpcRole, DrpcState } from '@credo-ts/drpc'
import {
  OpenId4VcIssuanceSessionRecord,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerRecord,
  OpenId4VcVerificationSessionRecord,
  OpenId4VcVerificationSessionState,
  OpenId4VcVerifierRecord,
} from '@credo-ts/openid4vc'
import { QuestionAnswerRecord, QuestionAnswerRole, QuestionAnswerState } from '@credo-ts/question-answer'
import { TenantRecord, TenantRoutingRecord } from '@credo-ts/tenants'
import { getTableColumns } from 'drizzle-orm'
import { sprindFunkeTestVectorBase64Url } from '../../../../core/src/modules/mdoc/__tests__/mdoc.fixtures'
import { Mdoc } from '../../../../core/src/modules/mdoc/Mdoc'
import { simpleJwtVc } from '../../../../core/src/modules/sd-jwt-vc/__tests__/sdjwtvc.fixtures'
import { CredoEs256DidJwkJwtVc } from '../../../../core/src/modules/vc/jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { Ed25519Signature2018Fixtures } from '../../../../core/src/modules/vc/linked-data-proofs/__tests__/fixtures'
import { didcommActionMenuDrizzleRecord } from '../../action-menu/action-menu-record'
import { anonCredsCredentialDefinitionPrivateDrizzleRecord } from '../../anoncreds/credential-definition-private-record'
import { anonCredsCredentialDefinitionDrizzleRecord } from '../../anoncreds/credential-definition-record'
import { anonCredsCredentialDrizzleRecord } from '../../anoncreds/credential-record'
import { anonCredsKeyCorrectnessProofDrizzleRecord } from '../../anoncreds/key-correctness-proof-record'
import { anonCredsLinkSecretDrizzleRecord } from '../../anoncreds/link-secret-record'
import { anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord } from '../../anoncreds/revocation-registry-definition-private-record'
import { anonCredsRevocationRegistryDefinitionDrizzleRecord } from '../../anoncreds/revocation-registry-definition-record'
import { anonCredsSchemaDrizzleRecord } from '../../anoncreds/schema-record'
import { didDrizzleRecord } from '../../core/did-record'
import { genericRecordDrizzleRecord } from '../../core/generic-record'
import { mdocDrizzleRecord } from '../../core/mdoc-record'
import { mdocVerificationSessionDrizzleRecord } from '../../core/mdoc-verification-session-record'
import { sdJwtVcDrizzleRecord } from '../../core/sd-jwt-vc-record'
import { singleContextLruCacheDrizzleRecord } from '../../core/single-context-lru-cache-record'
import { storageVersionDrizzleRecord } from '../../core/storage-version-record'
import { w3cCredentialDrizzleRecord } from '../../core/w3c-credential-record'
import { w3cV2CredentialDrizzleRecord } from '../../core/w3c-v2-credential-record'
import type { DrizzleRecord } from '../../DrizzleRecord'
import { didcommBasicMessageDrizzleRecord } from '../../didcomm/basic-message-record'
import { didcommConnectionDrizzleRecord } from '../../didcomm/connection-record'
import { didcommCredentialExchangeDrizzleRecord } from '../../didcomm/credential-exchange-record'
import { didcommMessageDrizzleRecord } from '../../didcomm/didcomm-message-record'
import { didcommMediationDrizzleRecord } from '../../didcomm/mediation-record'
import { didcommMediatorRoutingDrizzleRecord } from '../../didcomm/mediator-routing-record'
import { didcommOutOfBandDrizzleRecord } from '../../didcomm/out-of-band-record'
import { didcommProofExchangeDrizzleRecord } from '../../didcomm/proof-exchange-record'
import { didcommDrpcDrizzleRecord } from '../../drpc/drpc-record'
import { openId4VcIssuanceSessionDrizzleRecord } from '../../openid4vc/openid4vc-issuance-session-record'
import { openid4vcIssuerDrizzleRecord } from '../../openid4vc/openid4vc-issuer-record'
import { openId4VcVerificationSessionDrizzleRecord } from '../../openid4vc/openid4vc-verification-session-record'
import { openid4vcVerifierDrizzleRecord } from '../../openid4vc/openid4vc-verifier-record'
import { didcommQuestionAnswerDrizzleRecord } from '../../question-answer/question-answer-record'
import { tenantDrizzleRecord } from '../../tenants/tenant-record'
import { tenantRoutingDrizzleRecord } from '../../tenants/tenant-routing-record'
import type { AnyDrizzleAdapter } from '../BaseDrizzleRecordAdapter'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

const indyIssuerId = 'did:indy:sovrin:LjgpST2rjsoxYegQDRm7EL'
const indySchemaId = `${indyIssuerId}/anoncreds/v0/SCHEMA/Employee Credential/1.0.0`
const indyCredentialDefinitionId = `${indyIssuerId}/anoncreds/v0/CLAIM_DEF/12/default`
const indyRevocationRegistryDefinitionId = `${indyIssuerId}/anoncreds/v0/REV_REG_DEF/12/default/tag`

interface AdapterTestCase {
  name: string
  drizzleRecord: DrizzleRecord
  createRecord: () => BaseRecordAny

  /**
   * Tag columns for which the record doesn't return a tag. These are stored as null.
   */
  unsetColumns?: string[]
}

const testCases: AdapterTestCase[] = [
  {
    name: 'DidRecord',
    drizzleRecord: didDrizzleRecord,
    createRecord: () =>
      new DidRecord({
        did: 'did:example:123',
        role: DidDocumentRole.Created,
        didDocument: new DidDocument({ id: 'did:example:123' }),
        keys: [{ kmsKeyId: 'key-id', didDocumentRelativeKeyId: '#key-1' }],
        tags: { alternativeDids: ['did:example:456'] },
      }),
  },
  {
    name: 'DidRecord without did document',
    drizzleRecord: didDrizzleRecord,
    createRecord: () =>
      new DidRecord({
        did: 'did:example:123',
        role: DidDocumentRole.Received,
        tags: {
          recipientKeyFingerprints: ['z6MkhngxtGfzTvGVbFjVVqBHvniY1f2XrTMZLM5BZvPh31Dc'],
          alternativeDids: ['did:example:456'],
        },
      }),
  },
  {
    name: 'GenericRecord',
    drizzleRecord: genericRecordDrizzleRecord,
    createRecord: () => new GenericRecord({ content: { foo: 'bar', nested: { list: [1, 2] } } }),
  },
  {
    name: 'StorageVersionRecord',
    drizzleRecord: storageVersionDrizzleRecord,
    createRecord: () => new StorageVersionRecord({ storageVersion: '0.5' }),
  },
  {
    name: 'SingleContextLruCacheRecord',
    drizzleRecord: singleContextLruCacheDrizzleRecord,
    createRecord: () =>
      new SingleContextLruCacheRecord({
        entries: new Map([
          ['key-1', { value: { some: 'value' }, expiresAt: 1767225600 }],
          ['key-2', { value: 'value' }],
        ]),
      }),
  },
  {
    name: 'SdJwtVcRecord',
    drizzleRecord: sdJwtVcDrizzleRecord,
    createRecord: () =>
      new SdJwtVcRecord({
        credentialInstances: [{ compactSdJwtVc: simpleJwtVc, kmsKeyId: 'key-id' }],
        typeMetadata: { vct: 'IdentityCredential', name: 'Identity Credential' },
      }),
  },
  {
    name: 'MdocRecord',
    drizzleRecord: mdocDrizzleRecord,
    createRecord: () =>
      new MdocRecord({
        credentialInstances: [
          { issuerSignedBase64Url: Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url).base64Url, kmsKeyId: 'key-id' },
        ],
      }),
  },
  {
    name: 'MdocVerificationSessionRecord',
    drizzleRecord: mdocVerificationSessionDrizzleRecord,
    createRecord: () =>
      new MdocVerificationSessionRecord({
        state: MdocVerificationSessionState.RequestCreated,
        deviceRequestBase64Url: 'ZGV2aWNlLXJlcXVlc3Q',
        deviceRequestDefinition: {
          docRequests: [],
        } as unknown as MdocVerificationSessionRecord['deviceRequestDefinition'],
        sessionTranscript: { type: 'isoMdocDcApi', encryptionInfoBase64Url: 'ZW5jcnlwdGlvbi1pbmZv', nonce: 'nonce' },
        sessionKeyId: 'session-key-id',
        expiresAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
  },
  {
    name: 'W3cCredentialRecord',
    drizzleRecord: w3cCredentialDrizzleRecord,
    createRecord: () =>
      new W3cCredentialRecord({
        credentialInstances: [
          {
            credential: JsonTransformer.fromJSON(
              Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
              W3cJsonLdVerifiableCredential
            ).jsonCredential,
          },
        ],
        tags: { expandedTypes: ['https://expanded.tag#1'] },
      }),
    // Only set for jwt credentials
    unsetColumns: ['algs'],
  },
  {
    name: 'W3cV2CredentialRecord',
    drizzleRecord: w3cV2CredentialDrizzleRecord,
    createRecord: () => new W3cV2CredentialRecord({ credentialInstances: [{ credential: CredoEs256DidJwkJwtVc }] }),
    // Only set for data integrity credentials
    unsetColumns: ['cryptosuites'],
  },
  {
    name: 'DidCommConnectionRecord',
    drizzleRecord: didcommConnectionDrizzleRecord,
    createRecord: () =>
      new DidCommConnectionRecord({
        state: DidCommDidExchangeState.Completed,
        role: DidCommDidExchangeRole.Requester,
        did: 'did:peer:1',
        theirDid: 'did:peer:2',
        theirLabel: 'Their label',
        alias: 'alias',
        autoAcceptConnection: true,
        threadId: 'thread-id',
        imageUrl: 'https://example.com/image.png',
        mediatorId: 'mediator-id',
        protocol: DidCommHandshakeProtocol.DidExchange,
        outOfBandId: 'oob-id',
        invitationDid: 'did:peer:3',
        connectionTypes: ['mediator'],
        previousDids: ['did:peer:4'],
        previousTheirDids: ['did:peer:5'],
      }),
  },
  {
    name: 'DidCommOutOfBandRecord',
    drizzleRecord: didcommOutOfBandDrizzleRecord,
    createRecord: () =>
      new DidCommOutOfBandRecord({
        role: DidCommOutOfBandRole.Sender,
        state: DidCommOutOfBandState.AwaitResponse,
        outOfBandInvitation: new DidCommOutOfBandInvitation({
          id: 'invitation-id',
          label: 'label',
          services: ['did:peer:2'],
          handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
        }),
        alias: 'alias',
        reusable: true,
        autoAcceptConnection: true,
        mediatorId: 'mediator-id',
        reuseConnectionId: 'connection-id',
        invitationInlineServiceKeys: [{ recipientKeyFingerprint: 'z6Mk', kmsKeyId: 'key-id' }],
        tags: {
          recipientKeyFingerprints: ['z6MkhngxtGfzTvGVbFjVVqBHvniY1f2XrTMZLM5BZvPh31Dc'],
          recipientRoutingKeyFingerprint: 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
        },
      }),
  },
  {
    name: 'DidCommCredentialExchangeRecord',
    drizzleRecord: didcommCredentialExchangeDrizzleRecord,
    createRecord: () =>
      new DidCommCredentialExchangeRecord({
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
        connectionId: 'connection-id',
        threadId: 'thread-id',
        parentThreadId: 'parent-thread-id',
        protocolVersion: 'v2',
        credentialAttributes: [
          new DidCommCredentialPreviewAttribute({ name: 'name', value: 'value', mimeType: 'text/plain' }),
        ],
        revocationNotification: new DidCommRevocationNotification('revoked', new Date('2026-01-03T00:00:00.000Z')),
        errorMessage: 'error',
        credentials: [{ credentialRecordType: 'w3c', credentialRecordId: 'credential-id' }],
      }),
  },
  {
    name: 'DidCommProofExchangeRecord',
    drizzleRecord: didcommProofExchangeDrizzleRecord,
    createRecord: () =>
      new DidCommProofExchangeRecord({
        state: DidCommProofState.Done,
        role: DidCommProofRole.Verifier,
        connectionId: 'connection-id',
        threadId: 'thread-id',
        parentThreadId: 'parent-thread-id',
        protocolVersion: 'v2',
        isVerified: true,
        errorMessage: 'error',
      }),
  },
  {
    name: 'DidCommBasicMessageRecord',
    drizzleRecord: didcommBasicMessageDrizzleRecord,
    createRecord: () =>
      new DidCommBasicMessageRecord({
        connectionId: 'connection-id',
        role: DidCommBasicMessageRole.Sender,
        content: 'hello',
        sentTime: '2026-01-01T00:00:00.000Z',
        threadId: 'thread-id',
        parentThreadId: 'parent-thread-id',
      }),
  },
  {
    name: 'DidCommMessageRecord',
    drizzleRecord: didcommMessageDrizzleRecord,
    createRecord: () =>
      new DidCommMessageRecord({
        role: DidCommMessageRole.Sender,
        associatedRecordId: 'record-id',
        message: { '@type': 'https://didcomm.org/trust_ping/1.0/ping', '@id': 'message-id' },
      }),
  },
  {
    name: 'DidCommMediationRecord',
    drizzleRecord: didcommMediationDrizzleRecord,
    createRecord: () =>
      new DidCommMediationRecord({
        state: DidCommMediationState.Granted,
        role: DidCommMediationRole.Recipient,
        connectionId: 'connection-id',
        threadId: 'thread-id',
        endpoint: 'https://example.com',
        recipientKeys: ['recipient-key'],
        routingKeys: ['routing-key'],
        tags: { default: true },
      }),
  },
  {
    name: 'DidCommMediatorRoutingRecord',
    drizzleRecord: didcommMediatorRoutingDrizzleRecord,
    createRecord: () => {
      const record = new DidCommMediatorRoutingRecord({
        routingKeys: [
          { routingKeyFingerprint: 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH', kmsKeyId: 'key-id' },
        ],
      })

      // Records from before key ids were introduced store base58 keys
      record.routingKeys.push('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K')
      return record
    },
  },
  {
    name: 'ActionMenuRecord',
    drizzleRecord: didcommActionMenuDrizzleRecord,
    createRecord: () =>
      new ActionMenuRecord({
        state: ActionMenuState.Done,
        role: ActionMenuRole.Requester,
        connectionId: 'connection-id',
        threadId: 'thread-id',
        menu: new ActionMenu({
          title: 'title',
          description: 'description',
          options: [{ name: 'option', title: 'Option', description: 'An option' }],
        }),
        performedAction: new ActionMenuSelection({ name: 'option', params: { key: 'value' } }),
      }),
  },
  {
    name: 'QuestionAnswerRecord',
    drizzleRecord: didcommQuestionAnswerDrizzleRecord,
    createRecord: () =>
      new QuestionAnswerRecord({
        connectionId: 'connection-id',
        role: QuestionAnswerRole.Questioner,
        state: QuestionAnswerState.AnswerReceived,
        threadId: 'thread-id',
        signatureRequired: false,
        questionText: 'Question?',
        questionDetail: 'Detail',
        validResponses: [{ text: 'Yes' }, { text: 'No' }],
        response: 'Yes',
      }),
  },
  {
    name: 'DrpcRecord',
    drizzleRecord: didcommDrpcDrizzleRecord,
    createRecord: () => {
      const record = new DrpcRecord({
        connectionId: 'connection-id',
        role: DrpcRole.Client,
        state: DrpcState.Completed,
        threadId: 'thread-id',
        request: { jsonrpc: '2.0', method: 'hello', id: 1 },
        response: { jsonrpc: '2.0', result: 'world', id: 1 },
      })

      return record
    },
  },
  {
    name: 'TenantRecord',
    drizzleRecord: tenantDrizzleRecord,
    createRecord: () => new TenantRecord({ config: { label: 'Tenant' }, storageVersion: '0.5' }),
  },
  {
    name: 'TenantRoutingRecord',
    drizzleRecord: tenantRoutingDrizzleRecord,
    createRecord: () =>
      new TenantRoutingRecord({
        tenantId: 'tenant-id',
        recipientKeyFingerprint: 'z6MkhngxtGfzTvGVbFjVVqBHvniY1f2XrTMZLM5BZvPh31Dc',
      }),
  },
  {
    name: 'AnonCredsSchemaRecord',
    drizzleRecord: anonCredsSchemaDrizzleRecord,
    createRecord: () =>
      new AnonCredsSchemaRecord({
        schemaId: indySchemaId,
        methodName: 'indy',
        schema: { issuerId: indyIssuerId, name: 'Employee Credential', version: '1.0.0', attrNames: ['name'] },
      }),
  },
  {
    name: 'AnonCredsCredentialDefinitionRecord',
    drizzleRecord: anonCredsCredentialDefinitionDrizzleRecord,
    createRecord: () =>
      new AnonCredsCredentialDefinitionRecord({
        credentialDefinitionId: indyCredentialDefinitionId,
        methodName: 'indy',
        credentialDefinition: {
          issuerId: indyIssuerId,
          schemaId: indySchemaId,
          type: 'CL',
          tag: 'default',
          value: { primary: { n: '1' } },
        },
      }),
  },
  {
    name: 'AnonCredsCredentialDefinitionPrivateRecord',
    drizzleRecord: anonCredsCredentialDefinitionPrivateDrizzleRecord,
    createRecord: () =>
      new AnonCredsCredentialDefinitionPrivateRecord({
        credentialDefinitionId: indyCredentialDefinitionId,
        value: { private: 'value' },
      }),
  },
  {
    name: 'AnonCredsKeyCorrectnessProofRecord',
    drizzleRecord: anonCredsKeyCorrectnessProofDrizzleRecord,
    createRecord: () =>
      new AnonCredsKeyCorrectnessProofRecord({
        credentialDefinitionId: indyCredentialDefinitionId,
        value: { proof: 'value' },
      }),
  },
  {
    name: 'AnonCredsRevocationRegistryDefinitionRecord',
    drizzleRecord: anonCredsRevocationRegistryDefinitionDrizzleRecord,
    createRecord: () =>
      new AnonCredsRevocationRegistryDefinitionRecord({
        revocationRegistryDefinitionId: indyRevocationRegistryDefinitionId,
        revocationRegistryDefinition: {
          issuerId: indyIssuerId,
          revocDefType: 'CL_ACCUM',
          credDefId: indyCredentialDefinitionId,
          tag: 'tag',
          value: {
            publicKeys: { accumKey: { z: 'z' } },
            maxCredNum: 100,
            tailsLocation: 'https://example.com/tails',
            tailsHash: 'hash',
          },
        },
      }),
  },
  {
    name: 'AnonCredsRevocationRegistryDefinitionPrivateRecord',
    drizzleRecord: anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord,
    createRecord: () => {
      const record = new AnonCredsRevocationRegistryDefinitionPrivateRecord({
        revocationRegistryDefinitionId: indyRevocationRegistryDefinitionId,
        credentialDefinitionId: indyCredentialDefinitionId,
        value: { private: 'value' },
        state: AnonCredsRevocationRegistryState.Active,
      })

      return record
    },
  },
  {
    name: 'AnonCredsLinkSecretRecord',
    drizzleRecord: anonCredsLinkSecretDrizzleRecord,
    createRecord: () => {
      const record = new AnonCredsLinkSecretRecord({ linkSecretId: 'link-secret-id', value: 'secret' })
      record.setTag('isDefault', true)

      return record
    },
  },
  {
    name: 'AnonCredsCredentialRecord',
    drizzleRecord: anonCredsCredentialDrizzleRecord,
    createRecord: () =>
      new AnonCredsCredentialRecord({
        credentialId: 'credential-id',
        credentialRevocationId: '1',
        linkSecretId: 'link-secret-id',
        methodName: 'indy',
        schemaName: 'Employee Credential',
        schemaVersion: '1.0.0',
        schemaIssuerId: indyIssuerId,
        issuerId: indyIssuerId,
        credential: {
          schema_id: indySchemaId,
          cred_def_id: indyCredentialDefinitionId,
          rev_reg_id: indyRevocationRegistryDefinitionId,
          values: { name: { raw: 'John', encoded: '1' } },
          signature: { signature: 'value' },
          signature_correctness_proof: { proof: 'value' },
        },
      }),
  },
  {
    name: 'OpenId4VcIssuerRecord',
    drizzleRecord: openid4vcIssuerDrizzleRecord,
    createRecord: () =>
      new OpenId4VcIssuerRecord({
        issuerId: 'issuer-id',
        accessTokenPublicJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: '11qYAYdk9Jtz7bQHmbT5D_Iy_fqpI6bD7Z2p1l9tUoQ',
          kid: 'key-id',
        },
        accessTokenSignerKmsBackend: 'backend',
        credentialConfigurationsSupported: {
          credential: { format: 'vc+sd-jwt', vct: 'IdentityCredential' },
        } as OpenId4VcIssuerRecord['credentialConfigurationsSupported'],
        dpopSigningAlgValuesSupported: ['EdDSA'],
        display: [{ name: 'Issuer', logo: { uri: 'https://example.com/logo.png' } }],
        authorizationServerConfigs: [{ type: 'direct', issuer: 'https://auth.example.com' }],
        batchCredentialIssuance: { batchSize: 10 },
      }),
  },
  {
    name: 'OpenId4VcIssuanceSessionRecord',
    drizzleRecord: openId4VcIssuanceSessionDrizzleRecord,
    createRecord: () =>
      new OpenId4VcIssuanceSessionRecord({
        createdAt,
        expiresAt: new Date('2026-01-03T00:00:00.000Z'),
        state: OpenId4VcIssuanceSessionState.CredentialRequestReceived,
        issuerId: 'issuer-id',
        clientId: 'client-id',
        preAuthorizedCode: 'pre-authorized-code',
        authorization: {
          code: 'code',
          codeExpiresAt: new Date('2026-01-01T00:10:00.000Z'),
          issuerState: 'issuer-state',
          subject: 'subject',
        },
        presentation: { required: true, authSession: 'auth-session' },
        chainedIdentity: {
          externalAuthorizationServerUrl: 'https://auth.example.com',
          requestUriReferenceValue: 'reference-value',
          requestUriExpiresAt: new Date('2026-01-01T00:20:00.000Z'),
          externalState: 'external-state',
        },
        transactions: [
          {
            transactionId: 'transaction-id',
            numberOfCredentials: 1,
            credentialConfigurationId: 'credential',
            deferredUntil: new Date('2026-01-01T01:00:00.000Z'),
            holderBinding: {
              proofType: 'jwt',
              bindingMethod: 'jwk',
              keys: [
                {
                  method: 'jwk',
                  jwk: Kms.PublicJwk.fromUnknown({
                    kty: 'OKP',
                    crv: 'Ed25519',
                    x: '11qYAYdk9Jtz7bQHmbT5D_Iy_fqpI6bD7Z2p1l9tUoQ',
                  }),
                },
              ],
            },
          },
        ],
        credentialOfferUri: 'https://issuer.example.com/offer',
        credentialOfferId: 'offer-id',
        credentialOfferPayload: {
          credential_issuer: 'https://issuer.example.com',
          credential_configuration_ids: ['credential'],
        },
        issuanceMetadata: { some: 'metadata' },
        generateRefreshTokens: true,
        openId4VciVersion: 'v1',
      }),
  },
  {
    name: 'OpenId4VcVerifierRecord',
    drizzleRecord: openid4vcVerifierDrizzleRecord,
    createRecord: () =>
      new OpenId4VcVerifierRecord({
        verifierId: 'verifier-id',
        clientMetadata: { client_name: 'Verifier', logo_uri: 'https://example.com/logo.png' },
      }),
  },
  {
    name: 'OpenId4VcVerificationSessionRecord',
    drizzleRecord: openId4VcVerificationSessionDrizzleRecord,
    createRecord: () =>
      new OpenId4VcVerificationSessionRecord({
        verifierId: 'verifier-id',
        state: OpenId4VcVerificationSessionState.RequestCreated,
        authorizationRequestId: 'request-id',
        authorizationRequestUri: 'openid4vp://?request_uri=https://example.com',
        authorizationRequestPayload: {
          response_type: 'vp_token',
          client_id: 'client-id',
          nonce: 'nonce',
          state: 'state',
        } as OpenId4VcVerificationSessionRecord['authorizationRequestPayload'] & {},
        expiresAt: new Date('2026-01-03T00:00:00.000Z'),
        openId4VpVersion: 'v1',
      }),
  },
]

// Columns that are set by the base adapter, see getValuesWithBase
const baseColumnNames = ['contextCorrelationId', 'id', 'createdAt', 'updatedAt', 'metadata', 'customTags']

const agentContext = { contextCorrelationId: 'default' } as AgentContext

/**
 * Simulates storing the values in the database and reading them back: JSON columns are stored as JSON,
 * and empty columns are returned as null, which are removed before calling toRecord.
 */
function storeValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, value instanceof Date ? value : JSON.parse(JSON.stringify(value))])
  )
}

/**
 * The record without its tags. The tags are compared using getTags, as the internal tags of a
 * loaded record may also contain tags that the record computes.
 */
function recordProperties(record: BaseRecordAny) {
  const { _tags, ...properties } = record.toJSON()

  return properties
}

describe.each(testCases)('drizzle adapter for $name', ({ drizzleRecord, createRecord, unsetColumns = [] }) => {
  if (!drizzleRecord.adapter) throw new Error('Drizzle record has no adapter')

  // The database is not used for mapping the values
  const adapter: AnyDrizzleAdapter = new drizzleRecord.adapter({} as never)

  function createTestRecord() {
    const record = createRecord()
    record.id = 'record-id'
    record.createdAt ??= createdAt
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    record.setTag('myCustomTag', 'hello')

    return record
  }

  test('loads the record that was stored', () => {
    const record = createTestRecord()
    const storedValues = storeValues(adapter.getValuesWithBase(agentContext, record))
    const loadedRecord = adapter.toRecord(storedValues)

    expect(loadedRecord).toBeInstanceOf(record.constructor)
    expect(recordProperties(loadedRecord)).toEqual(recordProperties(record))
    expect(loadedRecord.getTags()).toEqual(record.getTags())

    // Custom tags are restored
    expect(loadedRecord.getTag('myCustomTag')).toEqual('hello')
    for (const columnName of adapter.customTagColumns) {
      expect(loadedRecord.getTag(columnName)).toEqual(record.getTag(columnName))
    }
  })

  test('stores custom tags', () => {
    const record = createTestRecord()
    const values = adapter.getValuesWithBase(agentContext, record)

    expect(values.customTags).toMatchObject({ myCustomTag: 'hello' })

    // Tags stored as part of a property are not stored again
    for (const tagName of Object.keys(adapter.tagKeyMapping ?? {})) {
      expect(values.customTags).not.toHaveProperty(tagName)
    }

    // Make sure the test covers the custom tags with their own column
    for (const columnName of adapter.customTagColumns) {
      expect(record.getTags()[columnName]).toBeDefined()
      expect(values[columnName]).toEqual(record.getTags()[columnName])
    }
  })

  test('stores every record property in a column', () => {
    expect(() => adapter.validateRecordMapping()).not.toThrow()
  })

  test('defines every record property in the encoding schema', () => {
    const record = createTestRecord()
    const recordPropertyNames = getRecordPropertyNames(adapter.recordClass) ?? []

    // type and allowCache are defined by the record class, and not stored
    const propertiesNotInSchema = Object.keys(record).filter(
      (propertyName) => !['type', 'allowCache'].includes(propertyName) && !recordPropertyNames.includes(propertyName)
    )

    expect(propertiesNotInSchema).toEqual([])
  })

  test('stores a record property or a tag in every column', () => {
    const record = createTestRecord()
    const recordPropertyNames = getRecordPropertyNames(adapter.recordClass) ?? []
    const tagNames = Object.keys(record.getTags())

    const columnsWithoutValue = Object.keys(getTableColumns(adapter.table.sqlite)).filter(
      (columnName) =>
        !baseColumnNames.includes(columnName) &&
        !recordPropertyNames.includes(columnName) &&
        !tagNames.includes(columnName) &&
        !unsetColumns.includes(columnName)
    )

    expect(columnsWithoutValue).toEqual([])
  })
})

describe('validateRecordMapping', () => {
  test('throws when a record property has no column', () => {
    const adapter = new didcommBasicMessageDrizzleRecord.adapter({} as never)

    // Use the table of a record that misses most of the properties
    adapter.table = {
      postgres: storageVersionDrizzleRecord.postgres.storageVersion,
      sqlite: storageVersionDrizzleRecord.sqlite.storageVersion,
    } as never

    expect(() => adapter.validateRecordMapping()).toThrow(
      "Drizzle adapter for record DidCommBasicMessageRecord can't store the record: sqlite table has no column for record properties content, sentTime, connectionId, role, threadId, parentThreadId"
    )
  })

  test('throws when a custom tag column does not exist', () => {
    const adapter = new didDrizzleRecord.adapter({} as never)
    adapter.customTagColumns = ['alternativeDidz']

    expect(() => adapter.validateRecordMapping()).toThrow(
      'sqlite table has no column for custom tag columns alternativeDidz; postgres table has no column for custom tag columns alternativeDidz'
    )
  })
})
