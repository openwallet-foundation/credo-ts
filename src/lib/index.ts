// reflect-metadata used for class-transfomer + class-validator
import 'reflect-metadata';

export { Agent } from './agent/Agent';
export { InboundTransporter } from './transport/InboundTransporter';
export { OutboundTransporter } from './transport/OutboundTransporter';
export { encodeInvitationToUrl, decodeInvitationFromUrl } from './helpers';
export { InitConfig, OutboundPackage } from './types';

export { ConnectionRecord, ConnectionEventType } from './modules/connections';
export { BasicMessageRecord, BasicMessageEventType } from './modules/basic-messages';
export { CredentialRecord } from './modules/credentials';
export * from './modules/credentials';
export * from './modules/proofs';
export * from './modules/connections';
export * from './utils/JsonTransformer';
