import debugFactory from 'debug';

const debug = debugFactory('aries-framework-javascript');

export default {
  log: (...args: unknown[]) => {
    debug('', ...args);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logJson: (message: string, json: Record<string, any>) => {
    debug(`---------- ${message} ---------- \n`, JSON.stringify(json, null, 2), '\n');
  },
};
