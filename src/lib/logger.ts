import debugFactory from 'debug';

const debug = debugFactory('aries-framework-javascript');

/* eslint-disable no-console */
export default {
  log: (...args: any[]) => {
    debug('', ...args);
  },
  logJson: (message: string, json: {} | null) => {
    debug(`---------- ${message} ---------- \n`, JSON.stringify(json, null, 2), '\n');
  },
};
