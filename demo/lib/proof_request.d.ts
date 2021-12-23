import { Agent, ConnectionRecord } from '@aries-framework/core';
export declare const proof_request: (klm: Agent, annelein: Agent, connectionRecordKLM: ConnectionRecord, connectionRecordAnnelein: ConnectionRecord, credDefId: string) => Promise<void>;
