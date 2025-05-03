import type { AutoAcceptCredential, AutoAcceptProof, ConnectionRecord } from '../../didcomm/src'
import {
  CredentialEventTypes,
  CredentialsModule,
  DifPresentationExchangeProofFormatService,
  JsonLdCredentialFormatService,
  ProofEventTypes,
  ProofsModule,
  V2CredentialProtocol,
  V2ProofProtocol,
} from '../../didcomm/src'
import type { DefaultAgentModulesInput } from '../../didcomm/src/util/modules'
import { Agent, CacheModule, InMemoryLruCache, W3cCredentialsModule } from '../src'
import { customDocumentLoader } from '../src/modules/vc/data-integrity/__tests__/documentLoader'
import type { EventReplaySubject } from './events'

import { setupEventReplaySubjects } from './events'
import { getAgentOptions, makeConnection } from './helpers'
import { setupSubjectTransports } from './transport'

export type JsonLdTestsAgent = Agent<ReturnType<typeof getJsonLdModules> & DefaultAgentModulesInput>

export const getJsonLdModules = (
  _name: string,
  {
    autoAcceptCredentials,
    autoAcceptProofs,
  }: { autoAcceptCredentials?: AutoAcceptCredential; autoAcceptProofs?: AutoAcceptProof } = {}
) =>
  ({
    credentials: new CredentialsModule({
      credentialProtocols: [new V2CredentialProtocol({ credentialFormats: [new JsonLdCredentialFormatService()] })],
      autoAcceptCredentials,
    }),
    w3cCredentials: new W3cCredentialsModule({
      documentLoader: customDocumentLoader,
    }),
    proofs: new ProofsModule({
      autoAcceptProofs,
      proofProtocols: [new V2ProofProtocol({ proofFormats: [new DifPresentationExchangeProofFormatService()] })],
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  }) as const

interface SetupJsonLdTestsReturn<VerifierName extends string | undefined, CreateConnections extends boolean> {
  issuerAgent: JsonLdTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: JsonLdTestsAgent
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

  verifierAgent: VerifierName extends string ? JsonLdTestsAgent : undefined
  verifierReplay: VerifierName extends string ? EventReplaySubject : undefined

  credentialDefinitionId: string
}

export async function setupJsonLdTests<
  VerifierName extends string | undefined = undefined,
  CreateConnections extends boolean = true,
>({
  issuerName,
  holderName,
  verifierName,
  autoAcceptCredentials,
  autoAcceptProofs,
  createConnections,
}: {
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  createConnections?: CreateConnections
}): Promise<SetupJsonLdTestsReturn<VerifierName, CreateConnections>> {
  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      {},
      getJsonLdModules(issuerName, {
        autoAcceptCredentials,
        autoAcceptProofs,
      }),
      { requireDidcomm: true }
    )
  )

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      {},
      getJsonLdModules(holderName, {
        autoAcceptCredentials,
        autoAcceptProofs,
      }),
      { requireDidcomm: true }
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          {},
          getJsonLdModules(verifierName, {
            autoAcceptCredentials,
            autoAcceptProofs,
          }),
          { requireDidcomm: true }
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

    issuerHolderConnectionId: issuerHolderConnection?.id,
    holderIssuerConnectionId: holderIssuerConnection?.id,
    holderVerifierConnectionId: holderVerifierConnection?.id,
    verifierHolderConnectionId: verifierHolderConnection?.id,
  } as unknown as SetupJsonLdTestsReturn<VerifierName, CreateConnections>
}
