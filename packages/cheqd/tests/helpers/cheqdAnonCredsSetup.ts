import type { EventReplaySubject } from '../../../core/tests'
import type { CheqdDidCreateOptions } from '../../src'
import type {
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterSchemaReturnStateFinished,
  AnonCredsRegistry,
} from '@credo-ts/anoncreds'
import type { AutoAcceptProof, ConnectionRecord, AutoAcceptCredential } from '@credo-ts/core'

import {
  AnonCredsCredentialFormatService,
  AnonCredsProofFormatService,
  AnonCredsModule,
  DataIntegrityCredentialFormatService,
} from '@credo-ts/anoncreds'
import {
  CacheModule,
  InMemoryLruCache,
  Agent,
  CredoError,
  CredentialEventTypes,
  CredentialsModule,
  ProofEventTypes,
  ProofsModule,
  V2CredentialProtocol,
  V2ProofProtocol,
  DidsModule,
  PresentationExchangeProofFormatService,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { randomUUID } from 'crypto'

import { InMemoryAnonCredsRegistry } from '../../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { anoncreds } from '../../../anoncreds/tests/helpers'
import { sleep } from '../../../core/src/utils/sleep'
import {
  setupSubjectTransports,
  setupEventReplaySubjects,
  testLogger,
  getInMemoryAgentOptions,
  makeConnection,
} from '../../../core/tests'
import { CheqdDidRegistrar, CheqdDidResolver, CheqdModule } from '../../src'
import { getCheqdModuleConfig } from '../setupCheqdModule'

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type AnonCredsTestsAgent = Agent<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReturnType<typeof getAnonCredsModules> & { mediationRecipient?: any; mediator?: any }
>

export const getAnonCredsModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
  registries,
  seed,
  rpcUrl,
}: {
  seed?: string
  rpcUrl?: string
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  registries?: [AnonCredsRegistry, ...AnonCredsRegistry[]]
} = {}) => {
  const dataIntegrityCredentialFormatService = new DataIntegrityCredentialFormatService()
  const anonCredsCredentialFormatService = new AnonCredsCredentialFormatService()
  const anonCredsProofFormatService = new AnonCredsProofFormatService()
  const presentationExchangeProofFormatService = new PresentationExchangeProofFormatService()

  const modules = {
    cheqdSdk: new CheqdModule(getCheqdModuleConfig(seed, rpcUrl)),
    credentials: new CredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: [dataIntegrityCredentialFormatService, anonCredsCredentialFormatService],
        }),
      ],
    }),
    proofs: new ProofsModule({
      autoAcceptProofs,
      proofProtocols: [
        new V2ProofProtocol({
          proofFormats: [anonCredsProofFormatService, presentationExchangeProofFormatService],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: registries ?? [new InMemoryAnonCredsRegistry()],
      anoncreds,
    }),
    dids: new DidsModule({
      registrars: [new CheqdDidRegistrar()],
      resolvers: [new CheqdDidResolver()],
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  } as const

  return modules
}

interface SetupAnonCredsTestsReturn<VerifierName extends string | undefined, CreateConnections extends boolean> {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: CreateConnections extends true ? string : undefined
  holderIssuerConnectionId: CreateConnections extends true ? string : undefined

  issuerId: string

  verifierHolderConnectionId: CreateConnections extends true
    ? VerifierName extends string
      ? string
      : undefined
    : undefined
  holderVerifierConnectionId: CreateConnections extends true
    ? VerifierName extends string
      ? string
      : undefined
    : undefined

  verifierAgent: VerifierName extends string ? AnonCredsTestsAgent : undefined
  verifierReplay: VerifierName extends string ? EventReplaySubject : undefined

  schemaId: string
  credentialDefinitionId: string
}

async function createDid(agent: AnonCredsTestsAgent) {
  const privateKey = TypedArrayEncoder.fromString('000000000000000000000000000cheqd')
  const did = await agent.dids.create<CheqdDidCreateOptions>({
    method: 'cheqd',
    secret: {
      verificationMethod: {
        id: 'key-10',
        type: 'Ed25519VerificationKey2020',
        privateKey,
      },
    },
    options: {
      network: 'testnet',
      methodSpecificIdAlgo: 'uuid',
    },
  })
  expect(did.didState).toMatchObject({ state: 'finished' })
  return did.didState.did as string
}

export async function setupAnonCredsTests<
  VerifierName extends string | undefined = undefined,
  CreateConnections extends boolean = true
>({
  issuerName,
  holderName,
  verifierName,
  autoAcceptCredentials,
  autoAcceptProofs,
  attributeNames,
  createConnections,
  registries,
}: {
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  attributeNames: string[]
  createConnections?: CreateConnections
  registries?: [AnonCredsRegistry, ...AnonCredsRegistry[]]
}): Promise<SetupAnonCredsTestsReturn<VerifierName, CreateConnections>> {
  const issuerAgent = new Agent(
    getInMemoryAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
      })
    )
  )

  const holderAgent = new Agent(
    getInMemoryAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
      })
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getInMemoryAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          getAnonCredsModules({
            autoAcceptCredentials,
            autoAcceptProofs,
            registries,
          })
        )
      )
    : undefined

  setupSubjectTransports(verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent])
  const [issuerReplay, holderReplay, verifierReplay] = setupEventReplaySubjects(
    verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent],
    [CredentialEventTypes.CredentialStateChanged, ProofEventTypes.ProofStateChanged]
  )

  await issuerAgent.initialize()
  await holderAgent.initialize()
  if (verifierAgent) await verifierAgent.initialize()

  const issuerId = await createDid(issuerAgent)

  // Create default link secret for holder
  await holderAgent.modules.anoncreds.createLinkSecret({
    linkSecretId: 'default',
    setAsDefault: true,
  })

  const { credentialDefinition, schema } = await prepareForAnonCredsIssuance(issuerAgent, {
    attributeNames,
    issuerId,
  })

  let issuerHolderConnection: ConnectionRecord | undefined
  let holderIssuerConnection: ConnectionRecord | undefined
  let verifierHolderConnection: ConnectionRecord | undefined
  let holderVerifierConnection: ConnectionRecord | undefined

  if (createConnections ?? true) {
    ;[issuerHolderConnection, holderIssuerConnection] = await makeConnection(issuerAgent, holderAgent)

    if (verifierAgent) {
      ;[holderVerifierConnection, verifierHolderConnection] = await makeConnection(holderAgent, verifierAgent)
    }
  }

  return {
    issuerAgent,
    issuerReplay,

    holderAgent,
    holderReplay,

    issuerId,

    verifierAgent: verifierName ? verifierAgent : undefined,
    verifierReplay: verifierName ? verifierReplay : undefined,

    credentialDefinitionId: credentialDefinition.credentialDefinitionId,
    schemaId: schema.schemaId,

    issuerHolderConnectionId: issuerHolderConnection?.id,
    holderIssuerConnectionId: holderIssuerConnection?.id,
    holderVerifierConnectionId: holderVerifierConnection?.id,
    verifierHolderConnectionId: verifierHolderConnection?.id,
  } as unknown as SetupAnonCredsTestsReturn<VerifierName, CreateConnections>
}

export async function prepareForAnonCredsIssuance(
  agent: Agent,
  { attributeNames, issuerId }: { attributeNames: string[]; issuerId: string }
) {
  //const key = await agent.wallet.createKey({ keyType: KeyType.Ed25519 })

  const schema = await registerSchema(agent, {
    // TODO: update attrNames to attributeNames
    attrNames: attributeNames,
    name: `Schema ${randomUUID()}`,
    version: '1.0',
    issuerId,
  })

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  const credentialDefinition = await registerCredentialDefinition(agent, {
    schemaId: schema.schemaId,
    issuerId,
    tag: 'default',
  })

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  return {
    schema: {
      ...schema,
      schemaId: schema.schemaId,
    },
    credentialDefinition: {
      ...credentialDefinition,
      credentialDefinitionId: credentialDefinition.credentialDefinitionId,
    },
  }
}

async function registerSchema(
  agent: AnonCredsTestsAgent,
  schema: AnonCredsSchema
): Promise<RegisterSchemaReturnStateFinished> {
  const { schemaState } = await agent.modules.anoncreds.registerSchema({
    schema,
    options: {},
  })

  testLogger.test(`created schema with id ${schemaState.schemaId}`, schema)

  if (schemaState.state !== 'finished') {
    throw new CredoError(`Schema not created: ${schemaState.state === 'failed' ? schemaState.reason : 'Not finished'}`)
  }

  return schemaState
}

async function registerCredentialDefinition(
  agent: AnonCredsTestsAgent,
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
): Promise<RegisterCredentialDefinitionReturnStateFinished> {
  const { credentialDefinitionState } = await agent.modules.anoncreds.registerCredentialDefinition({
    credentialDefinition,
    options: {
      supportRevocation: false,
    },
  })

  if (credentialDefinitionState.state !== 'finished') {
    throw new CredoError(
      `Credential definition not created: ${
        credentialDefinitionState.state === 'failed' ? credentialDefinitionState.reason : 'Not finished'
      }`
    )
  }

  return credentialDefinitionState
}
