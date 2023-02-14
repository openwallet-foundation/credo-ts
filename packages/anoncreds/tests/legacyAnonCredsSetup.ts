import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type {
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsOfferCredentialFormat,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterSchemaReturnStateFinished,
} from '../src'
import type {
  AutoAcceptProof,
  BaseEvent,
  ConnectionRecord,
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
} from '@aries-framework/core'

import {
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
import testLogger from '@aries-framework/core/tests/logger'
import { randomUUID } from 'crypto'
import indySdk from 'indy-sdk'
import { ReplaySubject, Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import {
  genesisPath,
  getAgentOptions,
  makeConnection,
  taaAcceptanceMechanism,
  taaVersion,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests/helpers'
import {
  IndySdkAnonCredsRegistry,
  IndySdkModule,
  IndySdkSovDidRegistrar,
  IndySdkSovDidResolver,
} from '../../indy-sdk/src'
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
    indySdk: new IndySdkModule({
      indySdk,
      networks: [
        {
          isProduction: false,
          genesisPath,
          indyNamespace: `pool:localtest`,
          transactionAuthorAgreement: { version: taaVersion, acceptanceMechanism: taaAcceptanceMechanism },
        },
      ],
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
  holderReplay: ReplaySubject<BaseEvent>

  verifierAgent: AnonCredsTestsAgent
  verifierReplay: ReplaySubject<BaseEvent>

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
        requestedAttributes: attributes,
        requestedPredicates: predicates,
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
  issuerReplay: Subject<BaseEvent>

  holderAgent: AnonCredsTestsAgent
  holderReplay: Subject<BaseEvent>

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

interface SetupAnonCredsTestReturn<VerifierName extends string | undefined> {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>

  holderAgent: AnonCredsTestsAgent
  holderReplay: ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>

  issuerHolderConnectionId: string
  holderIssuerConnectionId: string

  verifierHolderConnectionId: VerifierName extends string ? string : undefined
  holderVerifierConnectionId: VerifierName extends string ? string : undefined

  verifierAgent: VerifierName extends string ? AnonCredsTestsAgent : undefined
  verifierReplay: VerifierName extends string
    ? ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>
    : undefined

  credentialDefinitionId: string
}

export async function setupAnonCredsTests<VerifierName extends string | undefined = undefined>({
  issuerName,
  holderName,
  verifierName,
  autoAcceptCredentials,
  autoAcceptProofs,
  attributeNames,
}: {
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  attributeNames: string[]
}): Promise<SetupAnonCredsTestReturn<VerifierName>> {
  const issuerMessages = new Subject<SubjectMessage>()
  const holderMessages = new Subject<SubjectMessage>()
  const verifierMessages = new Subject<SubjectMessage>()
  const subjectMap = {
    'rxjs:issuer': issuerMessages,
    'rxjs:holder': holderMessages,
    'rxjs:verifier': verifierMessages,
  }

  const modules = getLegacyAnonCredsModules({
    autoAcceptCredentials,
    autoAcceptProofs,
  })

  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      modules
    )
  )
  issuerAgent.registerInboundTransport(new SubjectInboundTransport(issuerMessages))
  issuerAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await issuerAgent.initialize()

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      modules
    )
  )
  holderAgent.registerInboundTransport(new SubjectInboundTransport(holderMessages))
  holderAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  await holderAgent.initialize()

  let verifierAgent: AnonCredsTestsAgent | undefined
  if (verifierName) {
    verifierAgent = new Agent(
      getAgentOptions(
        verifierName,
        {
          endpoints: ['rxjs:verifier'],
        },
        modules
      )
    )
    verifierAgent.registerInboundTransport(new SubjectInboundTransport(verifierMessages))
    verifierAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await verifierAgent.initialize()
  }

  const { credentialDefinition, schema } = await prepareForAnonCredsIssuance(issuerAgent, {
    attributeNames,
    // TODO: replace with more dynamic / generic value We should create a did using the dids module
    // and use that probably
    issuerId: issuerAgent.publicDid?.did as string,
  })

  const [issuerHolderConnection, holderIssuerConnection] = await makeConnection(issuerAgent, holderAgent)

  let verifierHolderConnection: ConnectionRecord | undefined
  let holderVerifierConnection: ConnectionRecord | undefined
  if (verifierAgent) {
    ;[holderVerifierConnection, verifierHolderConnection] = await makeConnection(holderAgent, verifierAgent)
  }

  const issuerReplay = new ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>()
  const holderReplay = new ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>()

  const verifierReplay = verifierAgent
    ? new ReplaySubject<CredentialStateChangedEvent | ProofStateChangedEvent>()
    : undefined

  issuerAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(issuerReplay)
  issuerAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(issuerReplay)

  holderAgent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .subscribe(holderReplay)
  holderAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(holderReplay)

  if (verifierAgent) {
    verifierAgent.events
      .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
      .subscribe(verifierReplay)
    verifierAgent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).subscribe(verifierReplay)
  }

  return {
    issuerAgent,
    issuerReplay,

    holderAgent,
    holderReplay,

    verifierAgent,
    verifierReplay,

    credentialDefinitionId: credentialDefinition.credentialDefinitionId,
    schemaId: schema.schemaId,

    issuerHolderConnectionId: issuerHolderConnection.id,
    holderIssuerConnectionId: holderIssuerConnection.id,
    holderVerifierConnectionId: holderVerifierConnection?.id,
    verifierHolderConnectionId: verifierHolderConnection?.id,
  } as unknown as SetupAnonCredsTestReturn<VerifierName>
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
  const { schemaState, registrationMetadata } = await agent.modules.anoncreds.registerSchema({
    schema,
    options: {
      didIndyNamespace: 'local:test',
    },
  })

  testLogger.test(`created schema with id ${schemaState.schemaId}`, schema)

  if (schemaState.state !== 'finished') {
    throw new AriesFrameworkError(`Schema not created: ${registrationMetadata.error}`)
  }

  return schemaState
}

async function registerCredentialDefinition(
  agent: AnonCredsTestsAgent,
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
): Promise<RegisterCredentialDefinitionReturnStateFinished> {
  const { registrationMetadata, credentialDefinitionState } =
    await agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition,
      options: {
        didIndyNamespace: 'local:test',
      },
    })

  if (credentialDefinitionState.state !== 'finished') {
    throw new AriesFrameworkError(`Credential definition not created: ${registrationMetadata.error}`)
  }

  return credentialDefinitionState
}
