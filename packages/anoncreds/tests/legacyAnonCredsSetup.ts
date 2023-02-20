import type { EventReplaySubject } from '../../core/tests'
import type {
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsOfferCredentialFormat,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterSchemaReturnStateFinished,
} from '../src'
import type { AutoAcceptProof, ConnectionRecord } from '@aries-framework/core'

import {
  CacheModule,
  InMemoryLruCache,
  Agent,
  AriesFrameworkError,
  AutoAcceptCredential,
  CredentialEventTypes,
  CredentialsModule,
  CredentialState,
  ProofEventTypes,
  ProofsModule,
  ProofState,
  V2CredentialProtocol,
  V2ProofProtocol,
  DidsModule,
} from '@aries-framework/core'
import { randomUUID } from 'crypto'

import { setupSubjectTransports, setupEventReplaySubjects } from '../../core/tests'
import {
  getAgentOptions,
  makeConnection,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import {
  IndySdkAnonCredsRegistry,
  IndySdkModule,
  IndySdkSovDidRegistrar,
  IndySdkSovDidResolver,
} from '../../indy-sdk/src'
import { getIndySdkModuleConfig } from '../../indy-sdk/tests/setupIndySdkModule'
import {
  V1CredentialProtocol,
  V1ProofProtocol,
  AnonCredsModule,
  LegacyIndyCredentialFormatService,
  LegacyIndyProofFormatService,
} from '../src'

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type AnonCredsTestsAgent = Agent<ReturnType<typeof getLegacyAnonCredsModules>>

export const getLegacyAnonCredsModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
}: { autoAcceptCredentials?: AutoAcceptCredential; autoAcceptProofs?: AutoAcceptProof } = {}) => {
  const indyCredentialFormat = new LegacyIndyCredentialFormatService()
  const indyProofFormat = new LegacyIndyProofFormatService()

  // Register the credential and proof protocols
  const modules = {
    credentials: new CredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new V1CredentialProtocol({ indyCredentialFormat }),
        new V2CredentialProtocol({
          credentialFormats: [indyCredentialFormat],
        }),
      ],
    }),
    proofs: new ProofsModule({
      autoAcceptProofs,
      proofProtocols: [
        new V1ProofProtocol({ indyProofFormat }),
        new V2ProofProtocol({
          proofFormats: [indyProofFormat],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new IndySdkAnonCredsRegistry()],
    }),
    dids: new DidsModule({
      resolvers: [new IndySdkSovDidResolver()],
      registrars: [new IndySdkSovDidRegistrar()],
    }),
    indySdk: new IndySdkModule(getIndySdkModuleConfig()),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  } as const

  return modules
}

export async function presentLegacyAnonCredsProof({
  verifierAgent,
  verifierReplay,

  holderAgent,
  holderReplay,

  verifierHolderConnectionId,

  request: { attributes, predicates },
}: {
  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  verifierAgent: AnonCredsTestsAgent
  verifierReplay: EventReplaySubject

  verifierHolderConnectionId: string
  request: {
    attributes?: Record<string, AnonCredsRequestedAttribute>
    predicates?: Record<string, AnonCredsRequestedPredicate>
  }
}) {
  let holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    state: ProofState.RequestReceived,
  })

  let verifierProofExchangeRecord = await verifierAgent.proofs.requestProof({
    connectionId: verifierHolderConnectionId,
    proofFormats: {
      indy: {
        name: 'Test Proof Request',
        requested_attributes: attributes,
        requested_predicates: predicates,
        version: '1.0',
      },
    },
    protocolVersion: 'v2',
  })

  let holderProofExchangeRecord = await holderProofExchangeRecordPromise

  const selectedCredentials = await holderAgent.proofs.selectCredentialsForRequest({
    proofRecordId: holderProofExchangeRecord.id,
  })

  const verifierProofExchangeRecordPromise = waitForProofExchangeRecordSubject(verifierReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.PresentationReceived,
  })

  await holderAgent.proofs.acceptRequest({
    proofRecordId: holderProofExchangeRecord.id,
    proofFormats: { indy: selectedCredentials.proofFormats.indy },
  })

  verifierProofExchangeRecord = await verifierProofExchangeRecordPromise

  // assert presentation is valid
  expect(verifierProofExchangeRecord.isVerified).toBe(true)

  holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.Done,
  })

  verifierProofExchangeRecord = await verifierAgent.proofs.acceptPresentation({
    proofRecordId: verifierProofExchangeRecord.id,
  })
  holderProofExchangeRecord = await holderProofExchangeRecordPromise

  return {
    verifierProofExchangeRecord,
    holderProofExchangeRecord,
  }
}

export async function issueLegacyAnonCredsCredential({
  issuerAgent,
  issuerReplay,

  holderAgent,
  holderReplay,

  issuerHolderConnectionId,
  offer,
}: {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: string
  offer: AnonCredsOfferCredentialFormat
}) {
  let issuerCredentialExchangeRecord = await issuerAgent.credentials.offerCredential({
    comment: 'some comment about credential',
    connectionId: issuerHolderConnectionId,
    protocolVersion: 'v1',
    credentialFormats: {
      indy: offer,
    },
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  let holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  await holderAgent.credentials.acceptOffer({
    credentialRecordId: holderCredentialExchangeRecord.id,
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  // Because we use auto-accept it can take a while to have the whole credential flow finished
  // Both parties need to interact with the ledger and sign/verify the credential
  holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.Done,
  })
  issuerCredentialExchangeRecord = await waitForCredentialRecordSubject(issuerReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.Done,
  })

  return {
    issuerCredentialExchangeRecord,
    holderCredentialExchangeRecord,
  }
}

interface SetupAnonCredsTestsReturn<VerifierName extends string | undefined, CreateConnections extends boolean> {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: CreateConnections extends true ? string : undefined
  holderIssuerConnectionId: CreateConnections extends true ? string : undefined

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
}: {
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  attributeNames: string[]
  createConnections?: CreateConnections
}): Promise<SetupAnonCredsTestsReturn<VerifierName, CreateConnections>> {
  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      getLegacyAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
      })
    )
  )

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      getLegacyAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
      })
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          getLegacyAnonCredsModules({
            autoAcceptCredentials,
            autoAcceptProofs,
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

  // Create default link secret for holder
  await holderAgent.modules.anoncreds.createLinkSecret({
    linkSecretId: 'default',
    setAsDefault: true,
  })

  const { credentialDefinition, schema } = await prepareForAnonCredsIssuance(issuerAgent, {
    attributeNames,
    // TODO: replace with more dynamic / generic value We should create a did using the dids module
    // and use that probably
    issuerId: issuerAgent.publicDid?.did as string,
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
  const schema = await registerSchema(agent, {
    // TODO: update attrNames to attributeNames
    attrNames: attributeNames,
    name: `Schema ${randomUUID()}`,
    version: '1.0',
    issuerId,
  })

  const credentialDefinition = await registerCredentialDefinition(agent, {
    schemaId: schema.schemaId,
    issuerId,
    tag: 'default',
  })

  return {
    schema,
    credentialDefinition,
  }
}

async function registerSchema(
  agent: AnonCredsTestsAgent,
  schema: AnonCredsSchema
): Promise<RegisterSchemaReturnStateFinished> {
  const { schemaState } = await agent.modules.anoncreds.registerSchema({
    schema,
    options: {
      didIndyNamespace: 'pool:localtest',
    },
  })

  testLogger.test(`created schema with id ${schemaState.schemaId}`, schema)

  if (schemaState.state !== 'finished') {
    throw new AriesFrameworkError(
      `Schema not created: ${schemaState.state === 'failed' ? schemaState.reason : 'Not finished'}`
    )
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
      didIndyNamespace: 'pool:localtest',
    },
  })

  if (credentialDefinitionState.state !== 'finished') {
    throw new AriesFrameworkError(
      `Credential definition not created: ${
        credentialDefinitionState.state === 'failed' ? credentialDefinitionState.reason : 'Not finished'
      }`
    )
  }

  return credentialDefinitionState
}
