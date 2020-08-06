import logger from '../logger';
import { Wallet } from '../wallet/Wallet';

export class LedgerService {
  wallet: Wallet;
  indy: Indy;
  poolHandle?: PoolHandle;

  constructor(wallet: Wallet, indy: Indy) {
    this.wallet = wallet;
    this.indy = indy;
  }

  async connect(poolName: string, poolConfig: PoolConfig) {
    try {
      logger.log(__dirname);

      logger.log('Creating pool config');
      await this.indy.createPoolLedgerConfig(poolName, poolConfig);
    } catch (e) {
      logger.log('PoolLedgerConfigAlreadyExists');
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
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetNymRequest(null, myDid);
    logger.log('request', request);
    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('response', response);
    const result = await this.indy.parseGetNymResponse(response);
    logger.log('result', result);
    return result;
  }

  async registerSchema(myDid: Did, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }

    const { name, attributes, version } = schemaTemplate;
    const [schemaId, schema] = await this.indy.issuerCreateSchema(myDid, name, version, attributes);
    logger.log('schemaId, schema', schemaId, schema);

    const request = await this.indy.buildSchemaRequest(myDid, schema);
    logger.log('request', request);

    const signedRequest = await this.wallet.signRequest(myDid, request);
    logger.log('signedRequest', signedRequest);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('response', response);

    return [schemaId, schema];
  }

  async getSchema(myDid: Did, schemaId: SchemaId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetSchemaRequest(myDid, schemaId);
    logger.log('request', request);
    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('response', response);
    const result = await this.indy.parseGetSchemaResponse(response);
    logger.log('Credential Schema from ledger: ', result);
    return result;
  }

  async registerDefinition(myDid: Did, credentialDefinitionTemplate: CredDefTemplate): Promise<[CredDefId, CredDef]> {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }

    if (!this.wallet.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    const { schema, tag, signatureType, config } = credentialDefinitionTemplate;

    const [credDefId, credDef] = await this.indy.issuerCreateAndStoreCredentialDef(
      this.wallet.wh,
      myDid,
      schema,
      tag,
      signatureType,
      config
    );
    const request = await this.indy.buildCredDefRequest(myDid, credDef);
    logger.log('request', request);

    const signedRequest = await this.wallet.signRequest(myDid, request);
    logger.log('signedRequest', signedRequest);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('response', response);

    return [credDefId, credDef];
  }

  async getDefinitionFromLedger(myDid: Did, credDefId: CredDefId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetCredDefRequest(myDid, credDefId);
    const response = await this.indy.submitRequest(this.poolHandle, request);
    const result = await this.indy.parseGetCredDefResponse(response);
    logger.log('Credential Definition from ledger: ', result);
    return result;
  }
}

export interface SchemaTemplate {
  name: string;
  version: string;
  attributes: string[];
}

export interface CredDefTemplate {
  schema: Schema;
  tag: string;
  signatureType: string;
  config: { support_revocation: boolean };
}
