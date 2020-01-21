import { Connection } from './index';

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.

export function toBeConnectedWith(received: Connection, connection: Connection) {
  const pass = received.did === connection.theirDid && received.verkey === connection.theirKey;
  if (pass) {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} not to be connected to with ${connection.theirDid}, ${connection.theirKey}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} to be connected to with ${connection.theirDid}, ${connection.theirKey}`,
      pass: false,
    };
  }
}
