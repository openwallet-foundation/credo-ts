import type {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommConnectionRecord,
  DidCommModuleConfigOptions,
} from '../../didcomm/src'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialV2Protocol,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommJsonLdCredentialFormatService,
  DidCommModule,
  DidCommProofEventTypes,
  DidCommProofV2Protocol,
} from '../../didcomm/src'
import { Agent, CacheModule, InMemoryLruCache, W3cCredentialsModule } from '../src'
import { customDocumentLoader } from '../src/modules/vc/data-integrity/__tests__/documentLoader'
import type { EventReplaySubject } from './events'

import { setupEventReplaySubjects } from './events'
import { getAgentOptions, makeConnection } from './helpers'
import { setupSubjectTransports } from './transport'

export type JsonLdTestsAgent = Agent<ReturnType<typeof getJsonLdModules>>

export const getJsonLdModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
  extraDidCommConfig,
}: {
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
  extraDidCommConfig?: DidCommModuleConfigOptions
} = {}) =>
  ({
    didcomm: new DidCommModule({
      connections: {
        autoAcceptConnections: true,
      },
      ...extraDidCommConfig,
      credentials: {
        credentialProtocols: [
          new DidCommCredentialV2Protocol({ credentialFormats: [new DidCommJsonLdCredentialFormatService()] }),
        ],
        autoAcceptCredentials,
      },
      proofs: {
        autoAcceptProofs,
        proofProtocols: [
          new DidCommProofV2Protocol({ proofFormats: [new DidCommDifPresentationExchangeProofFormatService()] }),
        ],
      },
    }),

    w3cCredentials: new W3cCredentialsModule({
      documentLoader: customDocumentLoader,
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
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
  createConnections?: CreateConnections
}): Promise<SetupJsonLdTestsReturn<VerifierName, CreateConnections>> {
  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {},
      {},
      getJsonLdModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        extraDidCommConfig: {
          endpoints: ['rxjs:issuer'],
        },
      }),
      { requireDidcomm: true }
    )
  )

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {},
      {},
      getJsonLdModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        extraDidCommConfig: {
          endpoints: ['rxjs:holder'],
        },
      }),
      { requireDidcomm: true }
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {},
          {},
          getJsonLdModules({
            autoAcceptCredentials,
            autoAcceptProofs,
            extraDidCommConfig: {
              endpoints: ['rxjs:verifier'],
            },
          }),
          { requireDidcomm: true }
        )
      )
    : undefined

  setupSubjectTransports(verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent])
  const [issuerReplay, holderReplay, verifierReplay] = setupEventReplaySubjects(
    verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent],
    [DidCommCredentialEventTypes.DidCommCredentialStateChanged, DidCommProofEventTypes.ProofStateChanged]
  )

  await issuerAgent.initialize()
  await holderAgent.initialize()
  if (verifierAgent) await verifierAgent.initialize()

  let issuerHolderConnection: DidCommConnectionRecord | undefined
  let holderIssuerConnection: DidCommConnectionRecord | undefined
  let verifierHolderConnection: DidCommConnectionRecord | undefined
  let holderVerifierConnection: DidCommConnectionRecord | undefined

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
