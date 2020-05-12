import uuid from 'uuid/v4';

export enum MessageType {
  BatchPickup = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/messagepickup/1.0/batch_pickup',
  Batch = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/messagepickup/1.0/batch',
}

export function createBatchPickupMessage() {
  return {
    '@id': uuid(),
    '@type': MessageType.BatchPickup,
  };
}

export function createBatchMessage(messages: JsonWebKey[]) {
  return {
    '@id': uuid(),
    '@type': MessageType.Batch,
    messages,
  };
}
