/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type {
  AgentDependencies,
  BaseEvent,
  BasicMessage,
  BasicMessageStateChangedEvent,
  ConnectionRecordProps,
  CredentialStateChangedEvent,
  InitConfig,
  InjectionToken,
  ProofStateChangedEvent,
  Wallet,
  Agent,
  CredentialState,
  ConnectionStateChangedEvent,
  Buffer,
} from '../src'
import type { AgentModulesInput, EmptyModuleMap } from '../src/agent/AgentModules'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../src/modules/connections/TrustPingEvents'
import type { ProofState } from '../src/modules/proofs/models/ProofState'
import type { WalletConfig } from '../src/types'
import type { Observable } from 'rxjs'

import { readFileSync } from 'fs'
import path from 'path'
import { lastValueFrom, firstValueFrom, ReplaySubject } from 'rxjs'
import { catchError, filter, map, take, timeout } from 'rxjs/operators'

import { agentDependencies, IndySdkPostgresWalletScheme } from '../../node/src'
import {
  ConnectionEventTypes,
  TypedArrayEncoder,
  AgentConfig,
  AgentContext,
  BasicMessageEventTypes,
  ConnectionRecord,
  CredentialEventTypes,
  DependencyManager,
  DidExchangeRole,
  DidExchangeState,
  HandshakeProtocol,
  InjectionSymbols,
  ProofEventTypes,
  TrustPingEventTypes,
} from '../src'
import { Key, KeyType } from '../src/crypto'
import { DidCommV1Service } from '../src/modules/dids'
import { DidKey } from '../src/modules/dids/methods/key'
import { OutOfBandRole } from '../src/modules/oob/domain/OutOfBandRole'
import { OutOfBandState } from '../src/modules/oob/domain/OutOfBandState'
import { OutOfBandInvitation } from '../src/modules/oob/messages'
import { OutOfBandRecord } from '../src/modules/oob/repository'
import { KeyDerivationMethod } from '../src/types'
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

export function getAgentOptions<AgentModules extends AgentModulesInput | EmptyModuleMap>(
  name: string,
  extraConfig: Partial<InitConfig> = {},
  modules?: AgentModules
): { config: InitConfig; modules: AgentModules; dependencies: AgentDependencies } {
  const random = uuid().slice(0, 4)
  const config: InitConfig = {
    label: `Agent: ${name} - ${random}`,
    walletConfig: {
      id: `Wallet: ${name} - ${random}`,
      key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa', // generated using indy.generateWalletKey
      keyDerivationMethod: KeyDerivationMethod.Raw,
    },
    autoAcceptConnections: true,
    // TODO: determine the log level based on an environment variable. This will make it
    // possible to run e.g. failed github actions in debug mode for extra logs
    logger: TestLogger.fromLogger(testLogger, name),
    ...extraConfig,
  }

  return { config, modules: (modules ?? {}) as AgentModules, dependencies: agentDependencies } as const
}

export function getPostgresAgentOptions<AgentModules extends AgentModulesInput | EmptyModuleMap>(
  name: string,
  extraConfig: Partial<InitConfig> = {},
  modules?: AgentModules
) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    walletConfig: {
      // NOTE: IndySDK Postgres database per wallet doesn't support special characters/spaces in the wallet name
      id: `PostGresWallet${name}`,
      key: `Key${name}`,
      storage: {
        type: 'postgres_storage',
        config: {
          url: 'localhost:5432',
          wallet_scheme: IndySdkPostgresWalletScheme.DatabasePerWallet,
        },
        credentials: {
          account: 'postgres',
          password: 'postgres',
          admin_account: 'postgres',
          admin_password: 'postgres',
        },
      },
    },
    autoAcceptConnections: true,
    autoUpdateStorageOnStartup: false,
    logger: TestLogger.fromLogger(testLogger, name),
    ...extraConfig,
  }

  return { config, dependencies: agentDependencies, modules: (modules ?? {}) as AgentModules } as const
}

export async function importExistingIndyDidFromPrivateKey(agent: Agent, privateKey: Buffer) {
  const key = await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
    privateKey,
  })

  // did is first 16 bytes of public key encoded as base58
  const unqualifiedIndyDid = TypedArrayEncoder.toBase58(key.publicKey.slice(0, 16))

  // import the did in the wallet so it can be used
  await agent.dids.import({ did: `did:indy:pool:localtest:${unqualifiedIndyDid}` })

  return unqualifiedIndyDid
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

const isProofStateChangedEvent = (e: BaseEvent): e is ProofStateChangedEvent =>
  e.type === ProofEventTypes.ProofStateChanged
const isCredentialStateChangedEvent = (e: BaseEvent): e is CredentialStateChangedEvent =>
  e.type === CredentialEventTypes.CredentialStateChanged
const isConnectionStateChangedEvent = (e: BaseEvent): e is ConnectionStateChangedEvent =>
  e.type === ConnectionEventTypes.ConnectionStateChanged
const isTrustPingReceivedEvent = (e: BaseEvent): e is TrustPingReceivedEvent =>
  e.type === TrustPingEventTypes.TrustPingReceivedEvent
const isTrustPingResponseReceivedEvent = (e: BaseEvent): e is TrustPingResponseReceivedEvent =>
  e.type === TrustPingEventTypes.TrustPingResponseReceivedEvent

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
    state?: ProofState
    previousState?: ProofState | null
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
          `ProofStateChangedEvent event not emitted within specified timeout: ${timeoutMs}
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
  const observable = agent.events.observable<TrustPingReceivedEvent>(TrustPingEventTypes.TrustPingReceivedEvent)

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
  return firstValueFrom(
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
    TrustPingEventTypes.TrustPingResponseReceivedEvent
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
  return firstValueFrom(
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

export function waitForCredentialRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
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
      filter(isCredentialStateChangedEvent),
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

export function waitForConnectionRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 15000, // sign and store credential in W3c credential protocols take several seconds
  }: {
    threadId?: string
    state?: DidExchangeState
    previousState?: DidExchangeState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueFrom(
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
    state?: DidExchangeState
    previousState?: DidExchangeState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged)
  return waitForConnectionRecordSubject(observable, options)
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
