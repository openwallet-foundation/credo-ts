/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import logger from '../logger';
import path from 'path';
import { Subject } from 'rxjs';
import { ConnectionRecord } from '../storage/ConnectionRecord';
import { Agent, InboundTransporter, OutboundTransporter } from '..';
import { OutboundPackage, WireMessage } from '../types';
import { SchemaTemplate, CredDefTemplate } from '../agent/LedgerService';
import { CredentialOfferTemplate } from '../protocols/credentials/CredentialService';
import { CredentialState } from '../protocols/credentials/CredentialState';
import { CredentialRecord } from '../storage/CredentialRecord';

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn');

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.

export function toBeConnectedWith(received: ConnectionRecord, connection: ConnectionRecord) {
  const pass = received.theirDid === connection.did && received.theirKey === connection.verkey;
  if (pass) {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} not to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: false,
    };
  }
}

export class SubjectInboundTransporter implements InboundTransporter {
  private subject: Subject<WireMessage>;

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  public start(agent: Agent) {
    this.subscribe(agent, this.subject);
  }

  private subscribe(agent: Agent, subject: Subject<WireMessage>) {
    subject.subscribe({
      next: (message: WireMessage) => agent.receiveMessage(message),
    });
  }
}

export class SubjectOutboundTransporter implements OutboundTransporter {
  private subject: Subject<WireMessage>;

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject;
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    logger.logJson(`Sending outbound message to connection ${outboundPackage.connection.id}`, outboundPackage.payload);
    const { payload } = outboundPackage;
    this.subject.next(payload);
  }
}

export async function makeConnection(agentA: Agent, agentB: Agent) {
  // eslint-disable-next-line prefer-const
  let { invitation, connectionRecord: agentAConnection } = await agentA.connections.createConnection();
  let agentBConnection = await agentB.connections.receiveInvitation(invitation);

  agentAConnection = await agentA.connections.returnWhenIsConnected(agentAConnection.id);
  agentBConnection = await agentB.connections.returnWhenIsConnected(agentBConnection.id);

  return {
    agentAConnection,
    agentBConnection,
  };
}

export async function registerSchema(agent: Agent, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
  const [schemaId] = await agent.ledger.registerCredentialSchema(schemaTemplate);
  const ledgerSchema = await agent.ledger.getSchema(schemaId);
  logger.logJson(`created schema with id ${schemaId}`, ledgerSchema);
  return [schemaId, ledgerSchema];
}

export async function registerDefinition(
  agent: Agent,
  definitionTemplate: CredDefTemplate
): Promise<[CredDefId, CredDef]> {
  const [credDefId] = await agent.ledger.registerCredentialDefinition(definitionTemplate);
  const ledgerCredDef = await agent.ledger.getCredentialDefinition(credDefId);
  logger.logJson(`created credential definition with id ${credDefId}`, ledgerCredDef);
  return [credDefId, ledgerCredDef];
}

export async function ensurePublicDidIsOnLedger(agent: Agent, publicDid: Did) {
  try {
    logger.log(`Ensure test DID ${publicDid} is written to ledger`);
    await agent.ledger.getPublicDid(publicDid);
  } catch (error) {
    // Unfortunately, this won't prevent from the test suite running because of Jest runner runs all tests
    // regardless of thrown errors. We're more explicit about the problem with this error handling.
    throw new Error(`Test DID ${publicDid} is not written on ledger or ledger is not available.`);
  }
}

export async function issueCredential({
  issuerAgent,
  issuerConnectionId,
  holderAgent,
  credentialTemplate,
}: {
  issuerAgent: Agent;
  issuerConnectionId: string;
  holderAgent: Agent;
  credentialTemplate: CredentialOfferTemplate;
}) {
  const issuerConnection = await issuerAgent.connections.getById(issuerConnectionId);

  await issuerAgent.credentials.issueCredential(issuerConnection, credentialTemplate);
  // We assume that Alice has only one credential and it's a credential from Faber
  let [holderCredential] = await poll(
    () => holderAgent.credentials.getCredentials(),
    (credentials: CredentialRecord[]) => credentials.length < 1,
    100
  );
  // Accept credential offer from Faber
  await holderAgent.credentials.acceptCredential(holderCredential);

  // We assume that Alice has only one credential and it's a credential from Faber
  const [issuerCredential] = await poll(
    () => issuerAgent.credentials.getCredentials(),
    (credentials: CredentialRecord[]) => credentials.length < 1 || credentials[0].state !== CredentialState.Done,
    100
  );

  // We assume that Alice has only one credential and it's a credential from Faber
  [holderCredential] = await poll(
    () => holderAgent.credentials.getCredentials(),
    (credentials: CredentialRecord[]) => credentials.length < 1 || credentials[0].state !== CredentialState.Done,
    100
  );

  return { issuerCredential, holderCredential };
}
