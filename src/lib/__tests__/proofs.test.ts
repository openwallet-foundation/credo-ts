/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
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
  ProofRequest,
  ProofState,
} from '../protocols/present-proof';
import { ProofRecord } from '../storage/ProofRecord';
import { JsonTransformer } from '../utils/JsonTransformer';

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

xdescribe('proofstest', () => {
  let faberAgent: Agent;
  let aliceAgent: Agent;
  let credDefId: CredDefId;

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

    const publidDid = faberAgent.getPublicDid()?.did ?? 'Th7MpTaRZVRYnPiabds81Y';
    await ensurePublicDidIsOnLedger(faberAgent, publidDid);
    await makeConnection(faberAgent, aliceAgent);
    await issueCredential({
      issuerAgent: faberAgent,
      issuerConnectionId: (await faberAgent.connections.getAll())[0].id,
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

  test(`test`, async () => {
    // We assume that Faber has only one connection and it's a connection with Alice
    const [] = await faberAgent.connections.getAll();
    const [holderConnection] = await aliceAgent.connections.getAll();

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

    await aliceAgent.proof.proposeProof(holderConnection.id, presentationPreview);

    // We assume that Faber has only one credential and it's a credential from Faber
    let [faberProof] = await poll(
      () => faberAgent.proof.getAll(),
      (proofRecords: ProofRecord[]) => proofRecords.length < 1,
      100
    );

    await faberAgent.proof.acceptProposal(faberProof.id);

    const [aliceProof] = await poll(
      () => faberAgent.proof.getAll(),
      (proofRecords: ProofRecord[]) => proofRecords.length < 1 || proofRecords[0].state !== ProofState.RequestReceived,
      100
    );

    const requestedCredentials = await aliceAgent.proof.getRequestedCredentialsForProofRequest(
      JsonTransformer.fromJSON(aliceProof.proofRequest, ProofRequest),
      presentationPreview
    );

    await aliceAgent.proof.acceptRequest(aliceProof.id, requestedCredentials);

    [faberProof] = await poll(
      () => faberAgent.proof.getById(faberProof.id),
      (proofRecord: ProofRecord) => proofRecord.state !== ProofState.PresentationReceived,
      100
    );

    await faberAgent.proof.acceptPresentation(faberProof.id);
  });
});
