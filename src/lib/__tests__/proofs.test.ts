/* eslint-disable no-console */
// @ts-ignore
import { Subject } from 'rxjs';
import indy from 'indy-sdk';
import { Agent } from '..';
import {
  ensurePublicDidIsOnLedger,
  makeConnection,
  registerDefinition,
  registerSchema,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  genesisPath,
  issueCredential,
} from './helpers';
import {
  CredentialPreview,
  CredentialPreviewAttribute,
} from '../protocols/credentials/messages/CredentialOfferMessage';
import { InitConfig } from '../types';
import {
  PredicateType,
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
  ProofState,
  EventType,
  ProofStateChangedEvent,
  ProofAttributeInfo,
  AttributeFilter,
  ProofPredicateInfo,
} from '../protocols/present-proof';
import { ProofRecord } from '../storage/ProofRecord';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import logger from '../logger';

async function waitForRecord(
  agent: Agent,
  { threadId, state, prevState }: { threadId?: string; state?: ProofState; prevState?: ProofState | null }
): Promise<ProofRecord> {
  return new Promise(resolve => {
    const listener = (event: ProofStateChangedEvent) => {
      const prevStateMatches = prevState === undefined || event.prevState === prevState;
      const threadIdMatches = threadId === undefined || event.proofRecord.tags.threadId === threadId;
      const stateMatches = state === undefined || event.proofRecord.state === state;

      if (prevStateMatches && threadIdMatches && stateMatches) {
        agent.proof.events.removeListener(EventType.StateChanged, listener);

        resolve(event.proofRecord);
      }
    };

    agent.proof.events.addListener(EventType.StateChanged, listener);
  });
}

const faberConfig: InitConfig = {
  label: 'Faber',
  walletConfig: { id: 'proofs-test-faber' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  publicDidSeed: process.env.TEST_AGENT_PUBLIC_DID_SEED,
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'proofs-test-faber-pool',
};

const aliceConfig: InitConfig = {
  label: 'Alice',
  walletConfig: { id: 'proofs-test-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  genesisPath,
  poolName: 'proofs-test-alice-pool',
};

const credentialPreview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
});

describe('Present Proof', () => {
  let faberAgent: Agent;
  let aliceAgent: Agent;
  let credDefId: CredDefId;
  let faberConnection: ConnectionRecord;
  let aliceConnection: ConnectionRecord;
  let presentationPreview: PresentationPreview;

  beforeAll(async () => {
    const faberMessages = new Subject();
    const aliceMessages = new Subject();

    const faberAgentInbound = new SubjectInboundTransporter(faberMessages);
    const faberAgentOutbound = new SubjectOutboundTransporter(aliceMessages);
    const aliceAgentInbound = new SubjectInboundTransporter(aliceMessages);
    const aliceAgentOutbound = new SubjectOutboundTransporter(faberMessages);

    faberAgent = new Agent(faberConfig, faberAgentInbound, faberAgentOutbound, indy);
    aliceAgent = new Agent(aliceConfig, aliceAgentInbound, aliceAgentOutbound, indy);
    await faberAgent.init();
    await aliceAgent.init();

    const schemaTemplate = {
      name: `test-schema-${Date.now()}`,
      attributes: ['name', 'age'],
      version: '1.0',
    };
    const [, ledgerSchema] = await registerSchema(faberAgent, schemaTemplate);

    const definitionTemplate = {
      schema: ledgerSchema,
      tag: 'TAG',
      signatureType: 'CL',
      config: { support_revocation: false },
    };
    const [ledgerCredDefId] = await registerDefinition(faberAgent, definitionTemplate);
    credDefId = ledgerCredDefId;

    const publidDid = faberAgent.getPublicDid()?.did;
    await ensurePublicDidIsOnLedger(faberAgent, publidDid!);
    const { agentAConnection, agentBConnection } = await makeConnection(faberAgent, aliceAgent);

    faberConnection = agentAConnection;
    aliceConnection = agentBConnection;

    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: faberConnection.id,
      holderAgent: aliceAgent,
      credentialTemplate: {
        credentialDefinitionId: credDefId,
        comment: 'some comment about credential',
        preview: credentialPreview,
      },
    });
  });

  afterAll(async () => {
    await faberAgent.closeAndDeleteWallet();
    await aliceAgent.closeAndDeleteWallet();
  });

  test('Alice start with proof proposal to Faber', async () => {
    const presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'name',
          credentialDefinitionId: credDefId,
          referent: '0',
          value: 'John',
        }),
      ],
      predicates: [
        new PresentationPreviewPredicate({
          name: 'age',
          credentialDefinitionId: credDefId,
          predicate: PredicateType.GreaterThanOrEqualTo,
          threshold: 50,
        }),
      ],
    });

    logger.log('Alice sends presentation proposal to Faber');
    let aliceProofRecord = await aliceAgent.proof.proposeProof(aliceConnection.id, presentationPreview);

    logger.log('Faber waits for presentation proposal from Alice');
    let faberProofRecord = await waitForRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.ProposalReceived,
    });

    logger.log('Faber accepts presentation proposal from Alice');
    faberProofRecord = await faberAgent.proof.acceptProposal(faberProofRecord.id);

    logger.log('Alice waits for presentation request from Faber');
    aliceProofRecord = await waitForRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.RequestReceived,
    });

    logger.log('Alice accepts presentation request from Faber');
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest;
    const requestedCredentials = await aliceAgent.proof.getRequestedCredentialsForProofRequest(
      indyProofRequest!,
      presentationPreview
    );
    await aliceAgent.proof.acceptRequest(aliceProofRecord.id, requestedCredentials);

    logger.log('Faber waits for presentation from Alice');
    faberProofRecord = await waitForRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.PresentationReceived,
    });

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true);

    // Faber accepts presentation
    await faberAgent.proof.acceptPresentation(faberProofRecord.id);

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.Done,
    });
  });

  test('Faber starts with proof requests to Alice', async () => {
    logger.log('Faber sends presentation request to Alice');

    const attributes = new Map();
    attributes.set(
      'name',
      new ProofAttributeInfo({
        name: 'name',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      })
    );

    const predicates = new Map();
    predicates.set(
      'age',
      new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      })
    );

    let faberProofRecord = await faberAgent.proof.requestProof(faberConnection.id, {
      name: 'test-proof-request',
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    });

    logger.log('Alice waits for presentation request from Faber');
    let aliceProofRecord = await waitForRecord(aliceAgent, {
      threadId: faberProofRecord.tags.threadId,
      state: ProofState.RequestReceived,
    });

    logger.log('Alice accepts presentation request from Faber');
    const indyProofRequest = aliceProofRecord.requestMessage?.indyProofRequest;
    const requestedCredentials = await aliceAgent.proof.getRequestedCredentialsForProofRequest(
      indyProofRequest!,
      presentationPreview
    );
    await aliceAgent.proof.acceptRequest(aliceProofRecord.id, requestedCredentials);

    logger.log('Faber waits for presentation from Alice');
    faberProofRecord = await waitForRecord(faberAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.PresentationReceived,
    });

    // assert presentation is valid
    expect(faberProofRecord.isVerified).toBe(true);

    // Faber accepts presentation
    await faberAgent.proof.acceptPresentation(faberProofRecord.id);

    // Alice waits till it receives presentation ack
    aliceProofRecord = await waitForRecord(aliceAgent, {
      threadId: aliceProofRecord.tags.threadId,
      state: ProofState.Done,
    });
  });
});
