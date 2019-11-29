import { Connection } from '../../src/lib/types';

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toBeConnectedWith(connection: Connection): R;
    }
  }
}

export {};
