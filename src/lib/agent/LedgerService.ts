import logger from '../logger';
import { Wallet } from '../wallet/Wallet';

export class LedgerService {
  wallet: Wallet;
  indy: Indy;
  poolHandle?: PoolHandle;
  authorAgreement?: AuthorAgreement;

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

    const requestWithTaa = await this.appendTaa(myDid, request);

    const signedRequest = await this.wallet.signRequest(myDid, requestWithTaa);
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
    const { schema, tag, signatureType, config } = credentialDefinitionTemplate;

    const [credDefId, credDef] = await this.wallet.createCredDef(myDid, schema, tag, signatureType, config);
    const request = await this.indy.buildCredDefRequest(myDid, credDef);
    logger.log('request', request);

    const requestWithTaa = await this.appendTaa(myDid, request);

    const signedRequest = await this.wallet.signRequest(myDid, requestWithTaa);
    logger.log('signedRequest', signedRequest);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('response', response);

    return [credDefId, credDef];
  }

  async getDefinition(myDid: Did, credDefId: CredDefId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetCredDefRequest(myDid, credDefId);
    logger.log('request', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('response', response);

    const result = await this.indy.parseGetCredDefResponse(response);
    logger.log('Credential Definition from ledger: ', result);

    return result;
  }

  async appendTaa(myDid: Did, request: LedgerRequest) {
    const authorAgreement = await this.getTransactionAuthorAgreement(myDid);
    const requestWithTaa = await this.indy.appendTxnAuthorAgreementAcceptanceToRequest(
      request,
      authorAgreement.text,
      authorAgreement.version,
      authorAgreement.digest,
      'click_agreement',
      Date.now() / 1000
    );
    return requestWithTaa;
  }

  async getTransactionAuthorAgreement(myDid: Did) {
    // TODO Replace this condition with memoization
    if (this.authorAgreement) {
      return this.authorAgreement;
    }

    logger.log('------------ getTransactionAuthorAgreement START ------------');
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetTxnAuthorAgreementRequest(myDid);
    logger.log('request', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);

    const authorAgreement: AuthorAgreement = response.result.data;

    const request2 = await this.indy.buildGetAcceptanceMechanismsRequest(myDid);
    logger.log('request', request);

    const response2 = await this.indy.submitRequest(this.poolHandle, request2);
    logger.log('response2', response2);

    logger.log('aml', response2.result.data.aml);

    logger.log('------------ getTransactionAuthorAgreement END ------------');
    this.authorAgreement = authorAgreement;

    return this.authorAgreement;
  }
}

interface AuthorAgreement {
  digest: string;
  version: string;
  text: string;
  ratification_ts: number;
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
