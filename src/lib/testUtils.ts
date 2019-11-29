import { Connection } from './types';

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.

export function toBeConnectedWith(received: Connection, connection: Connection) {
  const pass = received.did === connection.theirDid && received.verkey === connection.theirKey;
  if (pass) {
    return {
      message: () => `expected connection ${received.did} not to be connected to with ${connection.theirDid}`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected connection ${received.did} to be connected to with ${connection.theirDid}`,
      pass: false,
    };
  }
}
