/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type {
  AcceptCredentialOfferOptions,
  AgentDependencies,
  BasicMessage,
  BasicMessageStateChangedEvent,
  ConnectionRecordProps,
  CredentialDefinitionTemplate,
  CredentialStateChangedEvent,
  InitConfig,
  InjectionToken,
  ProofStateChangedEvent,
  SchemaTemplate,
  Wallet,
} from '../src'
import type { AgentModulesInput, EmptyModuleMap } from '../src/agent/AgentModules'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../src/modules/connections/TrustPingEvents'
import type { IndyOfferCredentialFormat } from '../src/modules/credentials/formats/indy/IndyCredentialFormat'
import type { ProofAttributeInfo, ProofPredicateInfoOptions } from '../src/modules/proofs/formats/indy/models'
import type { AutoAcceptProof } from '../src/modules/proofs/models/ProofAutoAcceptType'
import type { Awaited, WalletConfig } from '../src/types'
import type { CredDef, Schema } from 'indy-sdk'
import type { Observable } from 'rxjs'

import { readFileSync } from 'fs'
import path from 'path'
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, map, timeout } from 'rxjs/operators'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { BbsModule } from '../../bbs-signatures/src/BbsModule'
import { agentDependencies, WalletScheme } from '../../node/src'
import {
  CredentialsModule,
  IndyCredentialFormatService,
  JsonLdCredentialFormatService,
  V1CredentialProtocol,
  V2CredentialProtocol,
  W3cVcModule,
  Agent,
  AgentConfig,
  AgentContext,
  AriesFrameworkError,
  BasicMessageEventTypes,
  ConnectionRecord,
  CredentialEventTypes,
  CredentialState,
  TrustPingEventTypes,
  DependencyManager,
  DidExchangeRole,
  DidExchangeState,
  HandshakeProtocol,
  InjectionSymbols,
  ProofEventTypes,
} from '../src'
import { Key, KeyType } from '../src/crypto'
import { Attachment, AttachmentData } from '../src/decorators/attachment/Attachment'
import { AutoAcceptCredential } from '../src/modules/credentials/models/CredentialAutoAcceptType'
import { V1CredentialPreview } from '../src/modules/credentials/protocol/v1/messages/V1CredentialPreview'
import { DidCommV1Service } from '../src/modules/dids'
import { DidKey } from '../src/modules/dids/methods/key'
import { OutOfBandRole } from '../src/modules/oob/domain/OutOfBandRole'
import { OutOfBandState } from '../src/modules/oob/domain/OutOfBandState'
import { OutOfBandInvitation } from '../src/modules/oob/messages'
import { OutOfBandRecord } from '../src/modules/oob/repository'
import { PredicateType } from '../src/modules/proofs/formats/indy/models'
import { ProofState } from '../src/modules/proofs/models/ProofState'
import { V1PresentationPreview } from '../src/modules/proofs/protocol/v1/models/V1PresentationPreview'
import { customDocumentLoader } from '../src/modules/vc/__tests__/documentLoader'
import { KeyDerivationMethod } from '../src/types'
import { LinkedAttachment } from '../src/utils/LinkedAttachment'
import { uuid } from '../src/utils/uuid'

import testLogger, { TestLogger } from './logger'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn')

export const genesisTransactions = readFileSync(genesisPath).toString('utf-8')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'
const taaVersion = (process.env.TEST_AGENT_TAA_VERSION ?? '1') as `${number}.${number}` | `${number}`
const taaAcceptanceMechanism = process.env.TEST_AGENT_TAA_ACCEPTANCE_MECHANISM ?? 'accept'
export { agentDependencies }

export function getAgentOptions<AgentModules extends AgentModulesInput | EmptyModuleMap>(
  name: string,
  extraConfig: Partial<InitConfig> = {},
  modules?: AgentModules
): { config: InitConfig; modules: AgentModules; dependencies: AgentDependencies } {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    walletConfig: {
      id: `Wallet: ${name}`,
      key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa', // generated using indy.generateWalletKey
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
    publicDidSeed,
    autoAcceptConnections: true,
    connectToIndyLedgersOnStartup: false,
    indyLedgers: [
      {
        id: `pool-${name}`,
        isProduction: false,
        genesisPath,
        indyNamespace: `pool:localtest`,
        transactionAuthorAgreement: { version: taaVersion, acceptanceMechanism: taaAcceptanceMechanism },
      },
    ],
    // TODO: determine the log level based on an environment variable. This will make it
    // possible to run e.g. failed github actions in debug mode for extra logs
    logger: TestLogger.fromLogger(testLogger, name),
    ...extraConfig,
  }

  return { config, modules: (modules ?? {}) as AgentModules, dependencies: agentDependencies } as const
}

export function getPostgresAgentOptions(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    walletConfig: {
      id: `Wallet${name}`,
      key: `Key${name}`,
      storage: {
        type: 'postgres_storage',
        config: {
          url: 'localhost:5432',
          wallet_scheme: WalletScheme.DatabasePerWallet,
        },
        credentials: {
          account: 'postgres',
          password: 'postgres',
          admin_account: 'postgres',
          admin_password: 'postgres',
        },
      },
    },
    publicDidSeed,
    autoAcceptConnections: true,
    autoUpdateStorageOnStartup: false,
    indyLedgers: [
      {
        id: `pool-${name}`,
        indyNamespace: `pool:localtest`,
        isProduction: false,
        genesisPath,
      },
    ],
    logger: TestLogger.fromLogger(testLogger, name),
    ...extraConfig,
  }

  return { config, dependencies: agentDependencies } as const
}

export function getAgentConfig(
  name: string,
  extraConfig: Partial<InitConfig> = {}
): AgentConfig & { walletConfig: WalletConfig } {
  const { config, dependencies } = getAgentOptions(name, extraConfig)
  return new AgentConfig(config, dependencies) as AgentConfig & { walletConfig: WalletConfig }
}

export function getAgentContext({
  dependencyManager = new DependencyManager(),
  wallet,
  agentConfig,
  contextCorrelationId = 'mock',
  registerInstances = [],
}: {
  dependencyManager?: DependencyManager
  wallet?: Wallet
  agentConfig?: AgentConfig
  contextCorrelationId?: string
  // Must be an array of arrays as objects can't have injection tokens
  // as keys (it must be number, string or symbol)
  registerInstances?: Array<[InjectionToken, unknown]>
} = {}) {
  if (wallet) dependencyManager.registerInstance(InjectionSymbols.Wallet, wallet)
  if (agentConfig) dependencyManager.registerInstance(AgentConfig, agentConfig)

  // Register custom instances on the dependency manager
  for (const [token, instance] of registerInstances.values()) {
    dependencyManager.registerInstance(token, instance)
  }

  return new AgentContext({ dependencyManager, contextCorrelationId })
}

export async function waitForProofExchangeRecord(
  agent: Agent,
  options: {
    threadId?: string
    parentThreadId?: string
    state?: ProofState
    previousState?: ProofState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged)

  return waitForProofExchangeRecordSubject(observable, options)
}

export function waitForProofExchangeRecordSubject(
  subject: ReplaySubject<ProofStateChangedEvent> | Observable<ProofStateChangedEvent>,
  {
    threadId,
    parentThreadId,
    state,
    previousState,
    timeoutMs = 10000,
  }: {
    threadId?: string
    parentThreadId?: string
    state?: ProofState
    previousState?: ProofState | null
    timeoutMs?: number
  }
) {
  const observable: Observable<ProofStateChangedEvent> =
    subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueFrom(
    observable.pipe(
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.proofRecord.threadId === threadId),
      filter((e) => parentThreadId === undefined || e.payload.proofRecord.parentThreadId === parentThreadId),
      filter((e) => state === undefined || e.payload.proofRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `ProofStateChangedEvent event not emitted within specified timeout: ${timeoutMs}
  previousState: ${previousState},
  threadId: ${threadId},
  parentThreadId: ${parentThreadId},
  state: ${state}
}`
        )
      }),
      map((e) => e.payload.proofRecord)
    )
  )
}

export async function waitForTrustPingReceivedEvent(
  agent: Agent,
  options: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<TrustPingReceivedEvent>(TrustPingEventTypes.TrustPingReceivedEvent)

  return waitForTrustPingReceivedEventSubject(observable, options)
}

export function waitForTrustPingReceivedEventSubject(
  subject: ReplaySubject<TrustPingReceivedEvent> | Observable<TrustPingReceivedEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueFrom(
    observable.pipe(
      filter((e) => threadId === undefined || e.payload.message.threadId === threadId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `TrustPingReceivedEvent event not emitted within specified timeout: ${timeoutMs}
  threadId: ${threadId},
}`
        )
      }),
      map((e) => e.payload.message)
    )
  )
}

export async function waitForTrustPingResponseReceivedEvent(
  agent: Agent,
  options: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<TrustPingResponseReceivedEvent>(
    TrustPingEventTypes.TrustPingResponseReceivedEvent
  )

  return waitForTrustPingResponseReceivedEventSubject(observable, options)
}

export function waitForTrustPingResponseReceivedEventSubject(
  subject: ReplaySubject<TrustPingResponseReceivedEvent> | Observable<TrustPingResponseReceivedEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueFrom(
    observable.pipe(
      filter((e) => threadId === undefined || e.payload.message.threadId === threadId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `TrustPingResponseReceivedEvent event not emitted within specified timeout: ${timeoutMs}
  threadId: ${threadId},
}`
        )
      }),
      map((e) => e.payload.message)
    )
  )
}

export function waitForCredentialRecordSubject(
  subject: ReplaySubject<CredentialStateChangedEvent> | Observable<CredentialStateChangedEvent>,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 15000, // sign and store credential in W3c credential protocols take several seconds
  }: {
    threadId?: string
    state?: CredentialState
    previousState?: CredentialState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueFrom(
    observable.pipe(
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.credentialRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.credentialRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(`CredentialStateChanged event not emitted within specified timeout: {
  previousState: ${previousState},
  threadId: ${threadId},
  state: ${state}
}`)
      }),
      map((e) => e.payload.credentialRecord)
    )
  )
}

export async function waitForCredentialRecord(
  agent: Agent,
  options: {
    threadId?: string
    state?: CredentialState
    previousState?: CredentialState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
  return waitForCredentialRecordSubject(observable, options)
}

export async function waitForBasicMessage(agent: Agent, { content }: { content?: string }): Promise<BasicMessage> {
  return new Promise((resolve) => {
    const listener = (event: BasicMessageStateChangedEvent) => {
      const contentMatches = content === undefined || event.payload.message.content === content

      if (contentMatches) {
        agent.events.off<BasicMessageStateChangedEvent>(BasicMessageEventTypes.BasicMessageStateChanged, listener)

        resolve(event.payload.message)
      }
    }

    agent.events.on<BasicMessageStateChangedEvent>(BasicMessageEventTypes.BasicMessageStateChanged, listener)
  })
}

export function getMockConnection({
  state = DidExchangeState.InvitationReceived,
  role = DidExchangeRole.Requester,
  id = 'test',
  did = 'test-did',
  threadId = 'threadId',
  tags = {},
  theirLabel,
  theirDid = 'their-did',
}: Partial<ConnectionRecordProps> = {}) {
  return new ConnectionRecord({
    did,
    threadId,
    theirDid,
    id,
    role,
    state,
    tags,
    theirLabel,
  })
}

export function getMockOutOfBand({
  label,
  serviceEndpoint,
  recipientKeys = [
    new DidKey(Key.fromPublicKeyBase58('ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7', KeyType.Ed25519)).did,
  ],
  mediatorId,
  role,
  state,
  reusable,
  reuseConnectionId,
  imageUrl,
}: {
  label?: string
  serviceEndpoint?: string
  mediatorId?: string
  recipientKeys?: string[]
  role?: OutOfBandRole
  state?: OutOfBandState
  reusable?: boolean
  reuseConnectionId?: string
  imageUrl?: string
} = {}) {
  const options = {
    label: label ?? 'label',
    imageUrl: imageUrl ?? undefined,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    handshakeProtocols: [HandshakeProtocol.DidExchange],
    services: [
      new DidCommV1Service({
        id: `#inline-0`,
        priority: 0,
        serviceEndpoint: serviceEndpoint ?? 'http://example.com',
        recipientKeys,
        routingKeys: [],
      }),
    ],
  }
  const outOfBandInvitation = new OutOfBandInvitation(options)
  const outOfBandRecord = new OutOfBandRecord({
    mediatorId,
    role: role || OutOfBandRole.Receiver,
    state: state || OutOfBandState.Initial,
    outOfBandInvitation: outOfBandInvitation,
    reusable,
    reuseConnectionId,
    tags: {
      recipientKeyFingerprints: recipientKeys.map((didKey) => DidKey.fromDid(didKey).key.fingerprint),
    },
  })
  return outOfBandRecord
}

export async function makeConnection(agentA: Agent, agentB: Agent) {
  const agentAOutOfBand = await agentA.oob.createInvitation({
    handshakeProtocols: [HandshakeProtocol.Connections],
  })

  let { connectionRecord: agentBConnection } = await agentB.oob.receiveInvitation(agentAOutOfBand.outOfBandInvitation)

  agentBConnection = await agentB.connections.returnWhenIsConnected(agentBConnection!.id)
  let [agentAConnection] = await agentA.connections.findAllByOutOfBandId(agentAOutOfBand.id)
  agentAConnection = await agentA.connections.returnWhenIsConnected(agentAConnection!.id)

  return [agentAConnection, agentBConnection]
}

export async function registerSchema(agent: Agent, schemaTemplate: SchemaTemplate): Promise<Schema> {
  const schema = await agent.ledger.registerSchema(schemaTemplate)
  testLogger.test(`created schema with id ${schema.id}`, schema)
  return schema
}

export async function registerDefinition(
  agent: Agent,
  definitionTemplate: CredentialDefinitionTemplate
): Promise<CredDef> {
  const credentialDefinition = await agent.ledger.registerCredentialDefinition(definitionTemplate)
  testLogger.test(`created credential definition with id ${credentialDefinition.id}`, credentialDefinition)
  return credentialDefinition
}

export async function prepareForIssuance(agent: Agent, attributes: string[]) {
  const publicDid = agent.publicDid?.did

  if (!publicDid) {
    throw new AriesFrameworkError('No public did')
  }

  await ensurePublicDidIsOnLedger(agent, publicDid)

  const schema = await registerSchema(agent, {
    attributes,
    name: `schema-${uuid()}`,
    version: '1.0',
  })

  const definition = await registerDefinition(agent, {
    schema,
    signatureType: 'CL',
    supportRevocation: false,
    tag: 'default',
  })

  return {
    schema,
    definition,
    publicDid,
  }
}

export async function ensurePublicDidIsOnLedger(agent: Agent, publicDid: string) {
  try {
    testLogger.test(`Ensure test DID ${publicDid} is written to ledger`)
    await agent.ledger.getPublicDid(publicDid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // Unfortunately, this won't prevent from the test suite running because of Jest runner runs all tests
    // regardless of thrown errors. We're more explicit about the problem with this error handling.
    throw new Error(`Test DID ${publicDid} is not written on ledger or ledger is not available: ${error.message}`)
  }
}

/**
 * Assumes that the autoAcceptCredential is set to {@link AutoAcceptCredential.ContentApproved}
 */
export async function issueCredential({
  issuerAgent,
  issuerConnectionId,
  holderAgent,
  credentialTemplate,
}: {
  issuerAgent: Agent
  issuerConnectionId: string
  holderAgent: Agent
  credentialTemplate: IndyOfferCredentialFormat
}) {
  const issuerReplay = new ReplaySubject<CredentialStateChangedEvent>()
  const holderReplay = new ReplaySubject<CredentialStateChangedEvent>()

  issuerAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(issuerReplay)
  holderAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(holderReplay)

  let issuerCredentialRecord = await issuerAgent.credentials.offerCredential({
    comment: 'some comment about credential',
    connectionId: issuerConnectionId,
    protocolVersion: 'v1',
    credentialFormats: {
      indy: {
        attributes: credentialTemplate.attributes,
        credentialDefinitionId: credentialTemplate.credentialDefinitionId,
        linkedAttachments: credentialTemplate.linkedAttachments,
      },
    },
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  let holderCredentialRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  const acceptOfferOptions: AcceptCredentialOfferOptions = {
    credentialRecordId: holderCredentialRecord.id,
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  }

  await holderAgent.credentials.acceptOffer(acceptOfferOptions)

  // Because we use auto-accept it can take a while to have the whole credential flow finished
  // Both parties need to interact with the ledger and sign/verify the credential
  holderCredentialRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })
  issuerCredentialRecord = await waitForCredentialRecordSubject(issuerReplay, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })

  return {
    issuerCredential: issuerCredentialRecord,
    holderCredential: holderCredentialRecord,
  }
}

/**
 * Returns mock of function with correct type annotations according to original function `fn`.
 * It can be used also for class methods.
 *
 * @param fn function you want to mock
 * @returns mock function with type annotations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}

/**
 * Set a property using a getter value on a mocked oject.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function mockProperty<T extends {}, K extends keyof T>(object: T, property: K, value: T[K]) {
  Object.defineProperty(object, property, { get: () => value })
}

export async function presentProof({
  verifierAgent,
  verifierConnectionId,
  holderAgent,
  presentationTemplate: { attributes, predicates },
}: {
  verifierAgent: Agent
  verifierConnectionId: string
  holderAgent: Agent
  presentationTemplate: {
    attributes?: Record<string, ProofAttributeInfo>
    predicates?: Record<string, ProofPredicateInfoOptions>
  }
}) {
  const verifierReplay = new ReplaySubject<ProofStateChangedEvent>()
  const holderReplay = new ReplaySubject<ProofStateChangedEvent>()

  verifierAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(verifierReplay)
  holderAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(holderReplay)

  let holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    state: ProofState.RequestReceived,
  })

  let verifierRecord = await verifierAgent.proofs.requestProof({
    connectionId: verifierConnectionId,
    proofFormats: {
      indy: {
        name: 'test-proof-request',
        requestedAttributes: attributes,
        requestedPredicates: predicates,
        version: '1.0',
      },
    },
    protocolVersion: 'v2',
  })

  let holderRecord = await holderProofExchangeRecordPromise

  const requestedCredentials = await holderAgent.proofs.selectCredentialsForRequest({
    proofRecordId: holderRecord.id,
  })

  const verifierProofExchangeRecordPromise = waitForProofExchangeRecordSubject(verifierReplay, {
    threadId: holderRecord.threadId,
    state: ProofState.PresentationReceived,
  })

  await holderAgent.proofs.acceptRequest({
    proofRecordId: holderRecord.id,
    proofFormats: { indy: requestedCredentials.proofFormats.indy },
  })

  verifierRecord = await verifierProofExchangeRecordPromise

  // assert presentation is valid
  expect(verifierRecord.isVerified).toBe(true)

  holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    threadId: holderRecord.threadId,
    state: ProofState.Done,
  })

  verifierRecord = await verifierAgent.proofs.acceptPresentation({ proofRecordId: verifierRecord.id })
  holderRecord = await holderProofExchangeRecordPromise

  return {
    verifierProof: verifierRecord,
    holderProof: holderRecord,
  }
}

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type CredentialTestsAgent = Awaited<ReturnType<typeof setupCredentialTests>>['aliceAgent']
export async function setupCredentialTests(
  faberName: string,
  aliceName: string,
  autoAcceptCredentials?: AutoAcceptCredential
) {
  const faberMessages = new Subject<SubjectMessage>()
  const aliceMessages = new Subject<SubjectMessage>()
  const subjectMap = {
    'rxjs:faber': faberMessages,
    'rxjs:alice': aliceMessages,
  }

  const indyCredentialFormat = new IndyCredentialFormatService()
  const jsonLdCredentialFormat = new JsonLdCredentialFormatService()

  // TODO remove the dependency on BbsModule
  const modules = {
    bbs: new BbsModule(),

    // Initialize custom credentials module (with jsonLdCredentialFormat enabled)
    credentials: new CredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new V1CredentialProtocol({ indyCredentialFormat }),
        new V2CredentialProtocol({
          credentialFormats: [indyCredentialFormat, jsonLdCredentialFormat],
        }),
      ],
    }),
    // Register custom w3cVc module so we can define the test document loader
    w3cVc: new W3cVcModule({
      documentLoader: customDocumentLoader,
    }),
  }
  const faberAgentOptions = getAgentOptions(
    faberName,
    {
      endpoints: ['rxjs:faber'],
    },
    modules
  )

  const aliceAgentOptions = getAgentOptions(
    aliceName,
    {
      endpoints: ['rxjs:alice'],
    },
    modules
  )
  const faberAgent = new Agent(faberAgentOptions)
  faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
  faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await faberAgent.initialize()

  const aliceAgent = new Agent(aliceAgentOptions)
  aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
  aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await aliceAgent.initialize()

  const {
    schema,
    definition: { id: credDefId },
  } = await prepareForIssuance(faberAgent, ['name', 'age', 'profile_picture', 'x-ray'])

  const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)

  const faberReplay = new ReplaySubject<CredentialStateChangedEvent>()
  const aliceReplay = new ReplaySubject<CredentialStateChangedEvent>()

  faberAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(faberReplay)
  aliceAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(aliceReplay)

  return { faberAgent, aliceAgent, credDefId, schema, faberConnection, aliceConnection, faberReplay, aliceReplay }
}

export async function setupProofsTest(faberName: string, aliceName: string, autoAcceptProofs?: AutoAcceptProof) {
  const credentialPreview = V1CredentialPreview.fromRecord({
    name: 'John',
    age: '99',
  })

  const unique = uuid().substring(0, 4)

  const faberAgentOptions = getAgentOptions(`${faberName} - ${unique}`, {
    autoAcceptProofs,
    endpoints: ['rxjs:faber'],
  })

  const aliceAgentOptions = getAgentOptions(`${aliceName} - ${unique}`, {
    autoAcceptProofs,
    endpoints: ['rxjs:alice'],
  })

  const faberMessages = new Subject<SubjectMessage>()
  const aliceMessages = new Subject<SubjectMessage>()

  const subjectMap = {
    'rxjs:faber': faberMessages,
    'rxjs:alice': aliceMessages,
  }
  const faberAgent = new Agent(faberAgentOptions)
  faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
  faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await faberAgent.initialize()

  const aliceAgent = new Agent(aliceAgentOptions)
  aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
  aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await aliceAgent.initialize()

  const { definition } = await prepareForIssuance(faberAgent, ['name', 'age', 'image_0', 'image_1'])

  const [agentAConnection, agentBConnection] = await makeConnection(faberAgent, aliceAgent)
  expect(agentAConnection.isReady).toBe(true)
  expect(agentBConnection.isReady).toBe(true)

  const faberConnection = agentAConnection
  const aliceConnection = agentBConnection

  const presentationPreview = new V1PresentationPreview({
    attributes: [
      {
        name: 'name',
        credentialDefinitionId: definition.id,
        referent: '0',
        value: 'John',
      },
      {
        name: 'image_0',
        credentialDefinitionId: definition.id,
      },
    ],
    predicates: [
      {
        name: 'age',
        credentialDefinitionId: definition.id,
        predicate: PredicateType.GreaterThanOrEqualTo,
        threshold: 50,
      },
    ],
  })

  await issueCredential({
    issuerAgent: faberAgent,
    issuerConnectionId: faberConnection.id,
    holderAgent: aliceAgent,
    credentialTemplate: {
      credentialDefinitionId: definition.id,
      attributes: credentialPreview.attributes,
      linkedAttachments: [
        new LinkedAttachment({
          name: 'image_0',
          attachment: new Attachment({
            filename: 'picture-of-a-cat.png',
            data: new AttachmentData({ base64: 'cGljdHVyZSBvZiBhIGNhdA==' }),
          }),
        }),
        new LinkedAttachment({
          name: 'image_1',
          attachment: new Attachment({
            filename: 'picture-of-a-dog.png',
            data: new AttachmentData({ base64: 'UGljdHVyZSBvZiBhIGRvZw==' }),
          }),
        }),
      ],
    },
  })
  const faberReplay = new ReplaySubject<ProofStateChangedEvent>()
  const aliceReplay = new ReplaySubject<ProofStateChangedEvent>()

  faberAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(faberReplay)
  aliceAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(aliceReplay)

  return {
    faberAgent,
    aliceAgent,
    credDefId: definition.id,
    faberConnection,
    aliceConnection,
    presentationPreview,
    faberReplay,
    aliceReplay,
  }
}
