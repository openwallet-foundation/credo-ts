import { askar } from '@openwallet-foundation/askar-nodejs'
import { readFileSync } from 'fs'
import path from 'path'
import type { Observable } from 'rxjs'
import { firstValueFrom, lastValueFrom, ReplaySubject } from 'rxjs'
import { catchError, filter, map, take, timeout } from 'rxjs/operators'
import type { MockedFunction } from 'vitest'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { AskarModule } from '../../askar/src/AskarModule'
import type { AskarModuleConfigStoreOptions } from '../../askar/src/AskarModuleConfig'
import { transformPrivateKeyToPrivateJwk } from '../../askar/src/utils'
import type {
  DidCommBasicMessage,
  DidCommBasicMessageStateChangedEvent,
  DidCommConnectionDidRotatedEvent,
  DidCommConnectionRecordProps,
  DidCommConnectionStateChangedEvent,
  DidCommCredentialExchangeRecord,
  DidCommCredentialState,
  DidCommCredentialStateChangedEvent,
  DidCommMessageProcessedEvent,
  DidCommOutOfBandInlineServiceKey,
  DidCommProofStateChangedEvent,
  DidCommRevocationNotificationReceivedEvent,
} from '../../didcomm/src'
import {
  DidCommBasicMessageEventTypes,
  DidCommConnectionEventTypes,
  DidCommConnectionRecord,
  DidCommCredentialEventTypes,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommEventTypes,
  DidCommHandshakeProtocol,
  DidCommModule,
  DidCommProofEventTypes,
  DidCommTrustPingEventTypes,
  OutOfBandDidCommService,
} from '../../didcomm/src'
import type { DidCommModuleConfigOptions } from '../../didcomm/src/DidCommModuleConfig'
import type {
  DidCommTrustPingReceivedEvent,
  TrustPingResponseReceivedEvent,
} from '../../didcomm/src/modules/connections/DidCommTrustPingEvents'
import { DidCommOutOfBandRole } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandState'
import { DidCommOutOfBandInvitation } from '../../didcomm/src/modules/oob/messages'
import { DidCommOutOfBandRecord } from '../../didcomm/src/modules/oob/repository'
import type { DidCommProofState } from '../../didcomm/src/modules/proofs'
import { DrizzleStorageModule } from '../../drizzle-storage/src'
import { anoncredsBundle } from '../../drizzle-storage/src/anoncreds/bundle'
import type { AnyDrizzleDatabase } from '../../drizzle-storage/src/DrizzleStorageModuleConfig'
import { didcommBundle } from '../../drizzle-storage/src/didcomm/bundle'
import { agentDependencies, NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../node/src'
import type {
  Agent,
  AgentDependencies,
  AnyUint8Array,
  BaseEvent,
  InitConfig,
  InjectionToken,
  KeyDidCreateOptions,
} from '../src'
import { AgentConfig, AgentContext, DependencyManager, DidsApi, Kms, TypedArrayEncoder, X509Api } from '../src'
import type { AgentModulesInput, EmptyModuleMap } from '../src/agent/AgentModules'
import { DidKey } from '../src/modules/dids/methods/key'
import { KeyManagementApi, type KeyManagementService, PublicJwk } from '../src/modules/kms'
import { sleep } from '../src/utils/sleep'
import { uuid } from '../src/utils/uuid'
import testLogger, { TestLogger } from './logger'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn')

export const genesisTransactions = readFileSync(genesisPath).toString('utf-8')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'
export const taaVersion = (process.env.TEST_AGENT_TAA_VERSION ?? '1') as `${number}.${number}` | `${number}`
export const taaAcceptanceMechanism = process.env.TEST_AGENT_TAA_ACCEPTANCE_MECHANISM ?? 'accept'
export { agentDependencies }

export function getAskarStoreConfig(
  name: string,
  {
    inMemory = true,
    random = uuid().slice(0, 4),
    maxConnections,
  }: { inMemory?: boolean; random?: string; maxConnections?: number } = {}
) {
  return {
    id: `Wallet: ${name} - ${random}`,
    key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa', // generated using indy.generateWalletKey
    keyDerivationMethod: 'raw',
    database: {
      type: 'sqlite',
      config: {
        inMemory,
        maxConnections,
      },
    },
  } satisfies AskarModuleConfigStoreOptions
}

export function getAgentOptions<
  AgentModules extends AgentModulesInput | EmptyModuleMap,
  RequireDidComm extends boolean | undefined = undefined,
  // biome-ignore lint/complexity/noBannedTypes: no explanation
  DidCommConfig extends DidCommModuleConfigOptions = {},
>(
  name: string,
  didcommConfig?: DidCommConfig,
  extraConfig: Partial<InitConfig> = {},
  inputModules?: AgentModules,
  {
    requireDidcomm,
    inMemory = true,
    drizzle,
  }: { requireDidcomm?: RequireDidComm; inMemory?: boolean; drizzle?: AnyDrizzleDatabase } = {}
): {
  config: InitConfig
  // biome-ignore lint/complexity/noBannedTypes: no explanation
  modules: (RequireDidComm extends true ? { didcomm: DidCommModule<DidCommConfig> } : {}) &
    AgentModules & { drizzle?: DrizzleStorageModule }
  dependencies: AgentDependencies
  inMemory?: boolean
} {
  const config: InitConfig = {
    // TODO: determine the log level based on an environment variable. This will make it
    // possible to run e.g. failed github actions in debug mode for extra logs
    logger: TestLogger.fromLogger(testLogger, name),
    ...extraConfig,
  }

  const m = (inputModules ?? {}) as AgentModulesInput

  const kms = requireDidcomm ? 'askar' : 'in-memory'
  const storage = drizzle ? 'drizzle' : kms

  const drizzleModules = drizzle
    ? {
        drizzle: new DrizzleStorageModule({
          database: drizzle,
          bundles: [didcommBundle, anoncredsBundle],
        }),
      }
    : {}

  const _modules = {
    ...(storage === 'drizzle' ? drizzleModules : {}),
    ...(requireDidcomm
      ? {
          didcomm: new DidCommModule({
            connections: {
              autoAcceptConnections: true,
            },
            ...didcommConfig,
          }),
        }
      : {}),
    ...m,

    ...(kms === 'askar' || storage === 'askar'
      ? {
          askar: new AskarModule({
            askar,
            enableKms: kms === 'askar',
            enableStorage: storage === 'askar',
            store: getAskarStoreConfig(name, { inMemory }),
          }),
        }
      : {}),
    ...(kms === 'in-memory' || storage === 'in-memory'
      ? {
          inMemory: new InMemoryWalletModule({
            enableKms: kms === 'in-memory',
            enableStorage: storage === 'in-memory',
          }),
        }
      : {}),
  }

  return {
    config,
    modules:
      // biome-ignore lint/complexity/noBannedTypes: no explanation
      _modules as unknown as (RequireDidComm extends true ? { didcomm: DidCommModule<DidCommConfig> } : {}) &
        AgentModules & { drizzle?: DrizzleStorageModule },
    dependencies: agentDependencies,
  } as const
}

export async function importExistingIndyDidFromPrivateKey(agent: Agent, privateKey: AnyUint8Array) {
  const { privateJwk } = transformPrivateKeyToPrivateJwk({
    privateKey,
    type: {
      kty: 'OKP',
      crv: 'Ed25519',
    },
  })

  const key = await agent.kms.importKey({
    privateJwk,
  })

  const publicJwk = Kms.PublicJwk.fromPublicJwk(key.publicJwk as Kms.KmsJwkPublicOkp & { crv: 'Ed25519' })

  // did is first 16 bytes of public key encoded as base58
  const unqualifiedIndyDid = TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey.slice(0, 16))

  // import the did in the wallet so it can be used
  await agent.dids.import({
    did: `did:indy:pool:localtest:${unqualifiedIndyDid}`,
    keys: [
      {
        didDocumentRelativeKeyId: '#verkey',
        kmsKeyId: key.keyId,
      },
    ],
  })

  return unqualifiedIndyDid
}

export function getAgentConfig(
  name: string,
  didcommConfig: Partial<DidCommModuleConfigOptions> = {},
  extraConfig: Partial<InitConfig> = {}
): AgentConfig {
  const { config, dependencies } = getAgentOptions(name, didcommConfig, extraConfig)
  return new AgentConfig(config, dependencies)
}

export function getAgentContext({
  dependencyManager = new DependencyManager(),
  agentConfig,
  contextCorrelationId = 'mock',
  registerInstances = [],
  kmsBackends = [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
  isRootAgentContext = true,
}: {
  dependencyManager?: DependencyManager
  agentConfig?: AgentConfig
  contextCorrelationId?: string
  kmsBackends?: KeyManagementService[]
  // Must be an array of arrays as objects can't have injection tokens
  // as keys (it must be number, string or symbol)
  registerInstances?: Array<[InjectionToken, unknown]>
  isRootAgentContext?: boolean
} = {}) {
  if (agentConfig) dependencyManager.registerInstance(AgentConfig, agentConfig)

  // Register custom instances on the dependency manager
  for (const [token, instance] of registerInstances.values()) {
    dependencyManager.registerInstance(token, instance)
  }

  const agentContext = new AgentContext({ dependencyManager, contextCorrelationId, isRootAgentContext })
  agentContext.dependencyManager.registerInstance(
    Kms.KeyManagementModuleConfig,
    new Kms.KeyManagementModuleConfig({
      backends: kmsBackends,
    })
  )
  agentContext.dependencyManager.registerContextScoped(KeyManagementApi)

  agentContext.dependencyManager.registerInstance(AgentContext, agentContext)
  return agentContext
}

export async function waitForProofExchangeRecord(
  agent: Agent,
  options: {
    threadId?: string
    parentThreadId?: string
    state?: DidCommProofState
    previousState?: DidCommProofState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommProofStateChangedEvent>(DidCommProofEventTypes.ProofStateChanged)

  return waitForProofExchangeRecordSubject(observable, options)
}

const isProofStateChangedEvent = (e: BaseEvent): e is DidCommProofStateChangedEvent =>
  e.type === DidCommProofEventTypes.ProofStateChanged
const isCredentialStateChangedEvent = (e: BaseEvent): e is DidCommCredentialStateChangedEvent =>
  e.type === DidCommCredentialEventTypes.DidCommCredentialStateChanged
const isConnectionStateChangedEvent = (e: BaseEvent): e is DidCommConnectionStateChangedEvent =>
  e.type === DidCommConnectionEventTypes.DidCommConnectionStateChanged
const isConnectionDidRotatedEvent = (e: BaseEvent): e is DidCommConnectionDidRotatedEvent =>
  e.type === DidCommConnectionEventTypes.DidCommConnectionDidRotated
const isTrustPingReceivedEvent = (e: BaseEvent): e is DidCommTrustPingReceivedEvent =>
  e.type === DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent
const isTrustPingResponseReceivedEvent = (e: BaseEvent): e is TrustPingResponseReceivedEvent =>
  e.type === DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent
const isAgentMessageProcessedEvent = (e: BaseEvent): e is DidCommMessageProcessedEvent =>
  e.type === DidCommEventTypes.DidCommMessageProcessed

export function waitForProofExchangeRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    parentThreadId,
    state,
    previousState,
    timeoutMs = 10000,
    count = 1,
  }: {
    threadId?: string
    parentThreadId?: string
    state?: DidCommProofState
    previousState?: DidCommProofState | null
    timeoutMs?: number
    count?: number
  }
) {
  const observable: Observable<BaseEvent> = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return lastValueFrom(
    observable.pipe(
      filter(isProofStateChangedEvent),
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.proofRecord.threadId === threadId),
      filter((e) => parentThreadId === undefined || e.payload.proofRecord.parentThreadId === parentThreadId),
      filter((e) => state === undefined || e.payload.proofRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `DidCommProofStateChangedEvent event not emitted within specified timeout: ${timeoutMs}
          previousState: ${previousState},
          threadId: ${threadId},
          parentThreadId: ${parentThreadId},
          state: ${state}
        }`
        )
      }),
      take(count),
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
  const observable = agent.events.observable<DidCommTrustPingReceivedEvent>(
    DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent
  )

  return waitForTrustPingReceivedEventSubject(observable, options)
}

export function waitForTrustPingReceivedEventSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueWithStackTrace(
    observable.pipe(
      filter(isTrustPingReceivedEvent),
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
    DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent
  )

  return waitForTrustPingResponseReceivedEventSubject(observable, options)
}

export function waitForTrustPingResponseReceivedEventSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueWithStackTrace(
    observable.pipe(
      filter(isTrustPingResponseReceivedEvent),
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

export async function waitForAgentMessageProcessedEvent(
  agent: Agent,
  options: {
    threadId?: string
    messageType?: string
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed)

  return waitForAgentMessageProcessedEventSubject(observable, options)
}

export async function firstValueWithStackTrace<T>(source: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(source)
  } catch (error) {
    // Errors from rxjs have a weird stack trace that doesn't lead to the original caller
    // So we update the stack trace
    Error.captureStackTrace(error)
    throw error
  }
}

export function waitForAgentMessageProcessedEventSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    timeoutMs = 10000,
    messageType,
  }: {
    threadId?: string
    messageType?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueWithStackTrace(
    observable.pipe(
      filter(isAgentMessageProcessedEvent),
      filter((e) => threadId === undefined || e.payload.message.threadId === threadId),
      filter((e) => messageType === undefined || e.payload.message.type === messageType),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `DidCommMessageProcessedEvent event not emitted within specified timeout: ${timeoutMs}
  threadId: ${threadId}, messageType: ${messageType}
}`
        )
      }),
      map((e) => e.payload.message)
    )
  )
}

export function waitForCredentialRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 15000, // sign and store credential in W3c credential protocols take several seconds
  }: {
    threadId?: string
    state?: DidCommCredentialState
    previousState?: DidCommCredentialState | null
    timeoutMs?: number
  }
): Promise<DidCommCredentialExchangeRecord> {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueWithStackTrace(
    observable.pipe(
      filter(isCredentialStateChangedEvent),
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.credentialExchangeRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.credentialExchangeRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(`DidCommCredentialStateChanged event not emitted within specified timeout: {
  previousState: ${previousState},
  threadId: ${threadId},
  state: ${state}
}`)
      }),
      map((e) => e.payload.credentialExchangeRecord)
    )
  )
}

export async function waitForCredentialRecord(
  agent: Agent,
  options: {
    threadId?: string
    state?: DidCommCredentialState
    previousState?: DidCommCredentialState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommCredentialStateChangedEvent>(
    DidCommCredentialEventTypes.DidCommCredentialStateChanged
  )
  return waitForCredentialRecordSubject(observable, options)
}

export function waitForDidRotateSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    state,
    timeoutMs = 15000, // sign and store credential in W3c credential protocols take several seconds
  }: {
    threadId?: string
    state?: DidCommDidExchangeState
    previousState?: DidCommDidExchangeState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueWithStackTrace(
    observable.pipe(
      filter(isConnectionDidRotatedEvent),
      filter((e) => threadId === undefined || e.payload.connectionRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.connectionRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(`ConnectionDidRotated event not emitted within specified timeout: {
  threadId: ${threadId},
  state: ${state}
}`)
      }),
      map((e) => e.payload)
    )
  )
}

export function waitForConnectionRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 15000, // sign and store credential in W3c credential protocols take several seconds
  }: {
    threadId?: string
    state?: DidCommDidExchangeState
    previousState?: DidCommDidExchangeState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueWithStackTrace(
    observable.pipe(
      filter(isConnectionStateChangedEvent),
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.connectionRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.connectionRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(`ConnectionStateChanged event not emitted within specified timeout: {
  previousState: ${previousState},
  threadId: ${threadId},
  state: ${state}
}`)
      }),
      map((e) => e.payload.connectionRecord)
    )
  )
}

export async function waitForConnectionRecord(
  agent: Agent,
  options: {
    threadId?: string
    state?: DidCommDidExchangeState
    previousState?: DidCommDidExchangeState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommConnectionStateChangedEvent>(
    DidCommConnectionEventTypes.DidCommConnectionStateChanged
  )
  return waitForConnectionRecordSubject(observable, options)
}

export async function waitForDidRotate(
  agent: Agent,
  options: {
    threadId?: string
    state?: DidCommDidExchangeState
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommConnectionDidRotatedEvent>(
    DidCommConnectionEventTypes.DidCommConnectionDidRotated
  )
  return waitForDidRotateSubject(observable, options)
}

export async function waitForBasicMessage(
  agent: Agent,
  { content, connectionId }: { content?: string; connectionId?: string }
): Promise<DidCommBasicMessage> {
  return new Promise((resolve) => {
    const listener = (event: DidCommBasicMessageStateChangedEvent) => {
      const contentMatches = content === undefined || event.payload.message.content === content
      const connectionIdMatches =
        connectionId === undefined || event.payload.basicMessageRecord.connectionId === connectionId

      if (contentMatches && connectionIdMatches) {
        agent.events.off<DidCommBasicMessageStateChangedEvent>(
          DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
          listener
        )

        resolve(event.payload.message)
      }
    }

    agent.events.on<DidCommBasicMessageStateChangedEvent>(
      DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
      listener
    )
  })
}

export async function waitForRevocationNotification(
  agent: Agent,
  options: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DidCommRevocationNotificationReceivedEvent>(
    DidCommCredentialEventTypes.DidCommRevocationNotificationReceived
  )

  return waitForRevocationNotificationSubject(observable, options)
}

export function waitForRevocationNotificationSubject(
  subject:
    | ReplaySubject<DidCommRevocationNotificationReceivedEvent>
    | Observable<DidCommRevocationNotificationReceivedEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueWithStackTrace(
    observable.pipe(
      filter((e) => threadId === undefined || e.payload.credentialExchangeRecord.threadId === threadId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `DidCommRevocationNotificationReceivedEvent event not emitted within specified timeout: {
    threadId: ${threadId},
  }`
        )
      }),
      map((e) => e.payload.credentialExchangeRecord)
    )
  )
}

export function getMockConnection({
  state = DidCommDidExchangeState.InvitationReceived,
  role = DidCommDidExchangeRole.Requester,
  id = 'test',
  did = 'test-did',
  threadId = 'threadId',
  tags = {},
  theirLabel,
  theirDid = 'their-did',
}: Partial<DidCommConnectionRecordProps> = {}) {
  return new DidCommConnectionRecord({
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
    new DidKey(
      PublicJwk.fromPublicKey({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58('ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7'),
      })
    ).did,
  ],
  invitationInlineServiceKeys,
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
  role?: DidCommOutOfBandRole
  state?: DidCommOutOfBandState
  reusable?: boolean
  reuseConnectionId?: string
  invitationInlineServiceKeys?: DidCommOutOfBandInlineServiceKey[]
  imageUrl?: string
} = {}) {
  const options = {
    label: label ?? 'label',
    imageUrl: imageUrl ?? undefined,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    services: [
      new OutOfBandDidCommService({
        id: '#inline-0',
        serviceEndpoint: serviceEndpoint ?? 'http://example.com',
        recipientKeys,
        routingKeys: [],
      }),
    ],
  }
  const outOfBandInvitation = new DidCommOutOfBandInvitation(options)
  const outOfBandRecord = new DidCommOutOfBandRecord({
    mediatorId,
    invitationInlineServiceKeys,
    role: role || DidCommOutOfBandRole.Receiver,
    state: state || DidCommOutOfBandState.Initial,
    outOfBandInvitation: outOfBandInvitation,
    reusable,
    reuseConnectionId,
    tags: {
      recipientKeyFingerprints: recipientKeys.map((didKey) => DidKey.fromDid(didKey).publicJwk.fingerprint),
    },
  })
  return outOfBandRecord
}

export async function makeConnection(
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  agentA: Agent<{ didcomm: DidCommModule<any> }>,
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  agentB: Agent<{ didcomm: DidCommModule<any> }>
) {
  const agentAOutOfBand = await agentA.didcomm.oob.createInvitation({
    handshakeProtocols: [DidCommHandshakeProtocol.Connections],
  })

  let { connectionRecord: agentBConnection } = await agentB.didcomm.oob.receiveInvitation(
    agentAOutOfBand.outOfBandInvitation,
    { label: '' }
  )

  // biome-ignore lint/style/noNonNullAssertion: no explanation
  agentBConnection = await agentB.didcomm.connections.returnWhenIsConnected(agentBConnection?.id!)
  let [agentAConnection] = await agentA.didcomm.connections.findAllByOutOfBandId(agentAOutOfBand.id)
  agentAConnection = await agentA.didcomm.connections.returnWhenIsConnected(agentAConnection?.id)

  return [agentAConnection, agentBConnection]
}

/**
 * Returns mock of function with correct type annotations according to original function `fn`.
 * It can be used also for class methods.
 *
 * @param fn function you want to mock
 * @returns mock function with type annotations
 */
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export function mockFunction<T extends (...args: any[]) => any>(fn: T): MockedFunction<T> {
  return fn as MockedFunction<T>
}

/**
 * Set a property using a getter value on a mocked oject.
 */
export function mockProperty<T extends {}, K extends keyof T>(object: T, property: K, value: T[K]) {
  Object.defineProperty(object, property, { get: () => value })
}

export async function retryUntilResult<T, M extends () => Promise<T | null>>(
  method: M,
  {
    intervalMs = 500,
    delay = 1000,
    maxAttempts = 5,
  }: {
    intervalMs?: number
    delay?: number
    maxAttempts?: number
  } = {}
): Promise<T> {
  await sleep(delay)

  for (let i = 0; i < maxAttempts; i++) {
    const result = await method()
    if (result) return result
    await sleep(intervalMs)
  }

  throw new Error(`Unable to get result from method in ${maxAttempts} attempts`)
}

export type CreateDidKidVerificationMethodReturn = Awaited<ReturnType<typeof createDidKidVerificationMethod>>
export async function createDidKidVerificationMethod(agentContext: AgentContext, secretKey?: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)
  const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

  const { keyId, publicJwk } = secretKey
    ? await kms.importKey({
        privateJwk: transformPrivateKeyToPrivateJwk({
          type: {
            kty: 'OKP',
            crv: 'Ed25519',
          },
          privateKey: TypedArrayEncoder.fromString(secretKey),
        }).privateJwk,
      })
    : await kms.createKey({
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      })

  const didCreateResult = await dids.create<KeyDidCreateOptions>({
    method: 'key',
    options: { keyId },
  })

  const did = didCreateResult.didState.did as string
  const didKey = DidKey.fromDid(did)
  const kid = `${did}#${didKey.publicJwk.fingerprint}`

  const verificationMethod = didCreateResult.didState.didDocument?.dereferenceKey(kid, ['authentication'])
  if (!verificationMethod) throw new Error('No verification method found')

  return { did, kid, verificationMethod, publicJwk: PublicJwk.fromPublicJwk(publicJwk) }
}

export async function createX509Certificate(agentContext: AgentContext, dns: string, key?: PublicJwk) {
  const x509 = agentContext.resolve(X509Api)
  const kms = agentContext.resolve(KeyManagementApi)

  const certificate = await x509.createCertificate({
    authorityKey:
      key ??
      Kms.PublicJwk.fromPublicJwk(
        (
          await kms.createKey({
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          })
        ).publicJwk
      ),
    issuer: {
      countryName: 'DE',
    },
    extensions: {
      subjectAlternativeName: {
        name: [{ type: 'dns', value: dns }],
      },
    },
  })

  return { certificate, base64Certificate: certificate.toString('base64') }
}
