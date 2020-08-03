import logger from '../logger';

export class LedgerService {
  indy: Indy;
  poolHandle?: PoolHandle;

  constructor(indy: Indy) {
    this.indy = indy;
  }

  async connect(poolName: string, poolConfig: PoolConfig) {
    try {
      logger.log(__dirname);

      logger.log('Creating pool config');
      await this.indy.createPoolLedgerConfig(poolName, poolConfig);
    } catch (e) {
      logger.log(e);
      if (e.message !== 'PoolLedgerConfigAlreadyExistsError') {
        throw e;
      }
    }

    logger.log('Setting protocol version');
    await this.indy.setProtocolVersion(2);

    logger.log('Opening pool');
    this.poolHandle = await this.indy.openPoolLedger(poolName);
  }

  async getPublicDid(myDid: Did) {
    if (!this.poolHandle) {
      throw new Error('There is no pool handle.');
    }
    const request = await this.indy.buildGetNymRequest(null, myDid);
    logger.log('request', request);
    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('response', response);
    const result = await this.indy.parseGetNymResponse(response);
    logger.log('result', result);
    return result;
  }
}
