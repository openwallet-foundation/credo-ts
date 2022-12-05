import type {
  DidCommV2MessageParams,
  DidResolutionResult,
  EncryptedMessage,
  PlaintextMessage,
  AgentContext,
} from '@aries-framework/core'
import type { Secret } from 'didcomm'

import {
  DidCommV2Message,
  DidCommV2Service,
  DidDocument,
  DidResolverService,
  isJsonObject,
  IsValidMessageType,
  parseMessageType,
  VerificationMethod,
} from '@aries-framework/core'
import { default as didcomm } from 'didcomm-node'

import { DidCommV2EnvelopeServiceImpl } from '../src/services'
import { DidCommV2DidResolver } from '../src/services/DidCommV2DidResolver'
import { DidCommV2SecretsResolver } from '../src/services/DidCommV2SecretsResolver'

import { getAgentContext, mockFunction } from './helpers'

jest.mock('@aries-framework/core', () => {
  const original = jest.requireActual('@aries-framework/core')
  return {
    __esModule: true,
    ...original,
    DidResolverService: jest.fn().mockImplementation(() => {
      return { resolve: jest.fn() }
    }),
  }
})

const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

jest.mock('../src/services/DidCommV2SecretsResolver')
const SecretsResolverMock = DidCommV2SecretsResolver as jest.Mock<DidCommV2SecretsResolver>

interface ForwardMessage {
  next: string
  forwardedMessage: EncryptedMessage
}

function parseForward(plaintextMessage: PlaintextMessage): ForwardMessage {
  expect(plaintextMessage.type).toBe('https://didcomm.org/routing/2.0/forward')

  expect(isJsonObject(plaintextMessage.body)).toBe(true)
  const body = plaintextMessage.body as Record<string, unknown>

  expect(typeof body.next).toBe('string')
  const next = body.next as string

  expect(Array.isArray(plaintextMessage.attachments)).toBe(true)
  const attachments = plaintextMessage.attachments as Array<unknown>

  expect(isJsonObject(attachments[0])).toBe(true)
  const attachment = attachments[0] as Record<string, unknown>

  expect(isJsonObject(attachment.data)).toBe(true)
  const attachmentData = attachment.data as Record<string, unknown>

  expect(isJsonObject(attachmentData.json)).toBe(true)
  const attachmentDataJson = attachmentData.json as Record<string, unknown>

  expect(typeof attachmentDataJson.protected).toBe('string')
  expect(typeof attachmentDataJson.iv).toBe('string')
  expect(typeof attachmentDataJson.ciphertext).toBe('string')
  expect(typeof attachmentDataJson.tag).toBe('string')
  const forwardedMessage = attachmentDataJson as EncryptedMessage

  return {
    next,
    forwardedMessage,
  }
}

type TestMessageParams = DidCommV2MessageParams

class TestMessage extends DidCommV2Message {
  public constructor(options?: TestMessageParams) {
    super(options)
  }

  @IsValidMessageType(TestMessage.type)
  public readonly type = TestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/test/2.0/example')
}

async function didResolutionSuccessResult(didDocument: DidDocument): Promise<DidResolutionResult> {
  return Promise.resolve({
    didResolutionMetadata: { contentType: 'application/did+ld+json' },
    didDocument,
    didDocumentMetadata: {},
  })
}

async function didResolutionFailureResult(): Promise<DidResolutionResult> {
  return Promise.resolve({
    didResolutionMetadata: {
      error: 'notFound',
      message: `DIDDoc not found.`,
    },
    didDocument: null,
    didDocumentMetadata: {},
  })
}

function oneKeySecretsResolver(secret: Secret) {
  const service = new SecretsResolverMock()
  mockFunction(service.find_secrets).mockImplementation(async (secret_ids) =>
    Promise.resolve(secret_ids.filter((value) => value == secret.id))
  )
  mockFunction(service.get_secret).mockImplementation(async (secret_id) =>
    Promise.resolve(secret_id == secret.id ? secret : null)
  )
  return service
}

const bobDidDocument = new DidDocument({
  id: 'did:example:bob',
  keyAgreement: ['did:example:bob#key-x25519'],
  verificationMethod: [
    new VerificationMethod({
      id: 'did:example:bob#key-x25519',
      type: 'JsonWebKey2020',
      controller: 'did:example:bob',
      publicKeyJwk: {
        kty: 'OKP',
        crv: 'X25519',
        x: 'GDTrI66K0pFfO54tlCSvfjjNapIs44dzpneBgyx0S3E',
      },
    }),
  ],
  service: [
    new DidCommV2Service({
      id: 'did:example:bob#did-comm-v2',
      serviceEndpoint: 'https://agent.com/did-comm-v2',
      routingKeys: ['did:example:mediator1', 'did:example:mediator2'],
      accept: ['didcomm/v2', 'didcomm/aip2;env=rfc587'],
    }),
  ],
})

const mediator1DidDocument = new DidDocument({
  id: 'did:example:mediator1',
  keyAgreement: ['did:example:mediator1#key-x25519'],
  verificationMethod: [
    new VerificationMethod({
      id: 'did:example:mediator1#key-x25519',
      type: 'JsonWebKey2020',
      controller: 'did:example:mediator1',
      publicKeyJwk: {
        kty: 'OKP',
        crv: 'X25519',
        x: 'UT9S3F5ep16KSNBBShU2wh3qSfqYjlasZimn0mB8_VM',
      },
    }),
  ],
})

const mediator2DidDocument = new DidDocument({
  id: 'did:example:mediator2',
  keyAgreement: ['did:example:mediator2#key-x25519'],
  verificationMethod: [
    new VerificationMethod({
      id: 'did:example:mediator2#key-x25519',
      type: 'JsonWebKey2020',
      controller: 'did:example:mediator2',
      publicKeyJwk: {
        kty: 'OKP',
        crv: 'X25519',
        x: '82k2BTUiywKv49fKLZa-WwDi8RBf0tB0M8bvSAUQ3yY',
      },
    }),
  ],
})

const bobSecret = {
  id: 'did:example:bob#key-x25519',
  type: 'JsonWebKey2020',
  secret_material: {
    format: 'JWK',
    value: {
      kty: 'OKP',
      crv: 'X25519',
      x: 'GDTrI66K0pFfO54tlCSvfjjNapIs44dzpneBgyx0S3E',
      d: 'b9NnuOCB0hm7YGNvaE9DMhwH_wjZA1-gWD6dA0JWdL0',
    },
  },
}

const mediator1Secret = {
  id: 'did:example:mediator1#key-x25519',
  type: 'JsonWebKey2020',
  secret_material: {
    format: 'JWK',
    value: {
      kty: 'OKP',
      crv: 'X25519',
      x: 'UT9S3F5ep16KSNBBShU2wh3qSfqYjlasZimn0mB8_VM',
      d: 'p-vteoF1gopny1HXywt76xz_uC83UUmrgszsI-ThBKk',
    },
  },
}

const mediator2Secret = {
  id: 'did:example:mediator2#key-x25519',
  type: 'JsonWebKey2020',
  secret_material: {
    format: 'JWK',
    value: {
      kty: 'OKP',
      crv: 'X25519',
      x: '82k2BTUiywKv49fKLZa-WwDi8RBf0tB0M8bvSAUQ3yY',
      d: 'f9WJeuQXEItkGM8shN4dqFr5fLQLBasHnWZ-8dPaSo0',
    },
  },
}

describe('DIDCommV2EnvelopeService', () => {
  const envelopeService = new DidCommV2EnvelopeServiceImpl(didcomm)

  const didResolverService = new DidResolverServiceMock()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mockFunction(didResolverService.resolve).mockImplementation(async (agentContext, didUrl, _options) => {
    switch (didUrl) {
      case bobDidDocument.id:
        return didResolutionSuccessResult(bobDidDocument)
      case mediator1DidDocument.id:
        return didResolutionSuccessResult(mediator1DidDocument)
      case mediator2DidDocument.id:
        return didResolutionSuccessResult(mediator2DidDocument)
      default:
        return didResolutionFailureResult()
    }
  })

  const aliceAgentContext = getAgentContext()
  const aliceDidResolver = new DidCommV2DidResolver(aliceAgentContext, didResolverService)
  const aliceSecretsResolver = new SecretsResolverMock()
  registerResolversInContext(aliceAgentContext, aliceDidResolver, aliceSecretsResolver)

  const bobAgentContext = getAgentContext()
  const bobDidResolver = new DidCommV2DidResolver(bobAgentContext, didResolverService)
  const bobSecretsResolver = oneKeySecretsResolver(bobSecret)
  registerResolversInContext(bobAgentContext, bobDidResolver, bobSecretsResolver)

  const mediator1AgentContext = getAgentContext()
  const mediator1DidResolver = new DidCommV2DidResolver(mediator1AgentContext, didResolverService)
  const mediator1SecretsResolver = oneKeySecretsResolver(mediator1Secret)
  registerResolversInContext(mediator1AgentContext, mediator1DidResolver, mediator1SecretsResolver)

  const mediator2AgentContext = getAgentContext()
  const mediator2DidResolver = new DidCommV2DidResolver(mediator2AgentContext, didResolverService)
  const mediator2SecretsResolver = oneKeySecretsResolver(mediator2Secret)
  registerResolversInContext(mediator2AgentContext, mediator2DidResolver, mediator2SecretsResolver)

  test("packMessageEncrypted uses recipient's routing", async () => {
    const message = new TestMessage({
      to: 'did:example:bob',
      body: {
        greeting: 'Hello, world!',
      },
    }) as DidCommV2Message

    const packedForMediator1 = await envelopeService.packMessage(aliceAgentContext, message, {
      toDid: 'did:example:bob',
    })

    const unpackedByMediator1 = await envelopeService.unpackMessage(mediator1AgentContext, packedForMediator1)
    const forwardForMediator1 = parseForward(unpackedByMediator1.plaintextMessage)
    expect(forwardForMediator1.next).toBe('did:example:mediator2')
    const packedForMediator2 = forwardForMediator1.forwardedMessage

    const unpackedByMediator2 = await envelopeService.unpackMessage(mediator2AgentContext, packedForMediator2)
    const forwardForMediator2 = parseForward(unpackedByMediator2.plaintextMessage)
    expect(forwardForMediator2.next).toBe('did:example:bob')
    const packedForBob = forwardForMediator2.forwardedMessage

    const unpackedByBob = await envelopeService.unpackMessage(bobAgentContext, packedForBob)
    expect(unpackedByBob.plaintextMessage.type).toBe('https://didcomm.org/test/2.0/example')

    expect(isJsonObject(unpackedByBob.plaintextMessage.body)).toBe(true)
    const unpackedMessageBody = unpackedByBob.plaintextMessage.body as Record<string, unknown>

    expect(unpackedMessageBody.greeting).toBe('Hello, world!')
  })
})

function registerResolversInContext(
  agentContext: AgentContext,
  didResolver: DidCommV2DidResolver,
  secretsResolver: DidCommV2SecretsResolver
) {
  agentContext.dependencyManager.registerInstance(DidCommV2DidResolver, didResolver)
  agentContext.dependencyManager.registerInstance(DidCommV2SecretsResolver, secretsResolver)
}
