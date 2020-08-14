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
      logger.log(`Creating pool config with name "${poolName}".`);
      await this.indy.createPoolLedgerConfig(poolName, poolConfig);
    } catch (error) {
      if (error.message === 'PoolLedgerConfigAlreadyExistsError') {
        logger.log('PoolLedgerConfigAlreadyExistsError');
      } else {
        throw error;
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
    logger.log(`Register schema with ID = ${schemaId}:`, schema);

    const request = await this.indy.buildSchemaRequest(myDid, schema);
    logger.log('Register schema request', request);

    const requestWithTaa = await this.appendTaa(myDid, request);
    const signedRequest = await this.wallet.signRequest(myDid, requestWithTaa);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('Register schema response', response);

    return [schemaId, schema];
  }

  async getSchema(myDid: Did, schemaId: SchemaId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetSchemaRequest(myDid, schemaId);
    logger.log('Get schema request', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('Get schema response', response);

    const result = await this.indy.parseGetSchemaResponse(response);
    logger.log('Get schema result: ', result);

    return result;
  }

  async registerDefinition(myDid: Did, credentialDefinitionTemplate: CredDefTemplate): Promise<[CredDefId, CredDef]> {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const { schema, tag, signatureType, config } = credentialDefinitionTemplate;

    const [credDefId, credDef] = await this.wallet.createCredDef(myDid, schema, tag, signatureType, config);
    logger.log(`Register credential definition with ID = ${credDefId}:`, credDef);

    const request = await this.indy.buildCredDefRequest(myDid, credDef);
    logger.log('Register credential definition request:', request);

    const requestWithTaa = await this.appendTaa(myDid, request);
    const signedRequest = await this.wallet.signRequest(myDid, requestWithTaa);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('Register credential definition response:', response);

    return [credDefId, credDef];
  }

  async getDefinition(myDid: Did, credDefId: CredDefId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetCredDefRequest(myDid, credDefId);
    logger.log('Get credential definition request:', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('Get credential definition response:', response);

    const result = await this.indy.parseGetCredDefResponse(response);
    logger.log('Get credential definition result: ', result);

    return result;
  }

  private async appendTaa(myDid: Did, request: LedgerRequest) {
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

  private async getTransactionAuthorAgreement(myDid: Did) {
    // TODO Replace this condition with memoization
    if (this.authorAgreement) {
      return this.authorAgreement;
    }

    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }

    const taaRequest = await this.indy.buildGetTxnAuthorAgreementRequest(myDid);
    const taaResponse = await this.indy.submitRequest(this.poolHandle, taaRequest);
    const acceptanceMechanismRequest = await this.indy.buildGetAcceptanceMechanismsRequest(myDid);
    const acceptanceMechanismResponse = await this.indy.submitRequest(this.poolHandle, acceptanceMechanismRequest);
    const acceptanceMechanisms = acceptanceMechanismResponse.result.data;

    const authorAgreement: AuthorAgreement = taaResponse.result.data;
    this.authorAgreement = { ...authorAgreement, acceptanceMechanisms };

    return this.authorAgreement;
  }
}

interface AuthorAgreement {
  digest: string;
  version: string;
  text: string;
  ratification_ts: number;
  acceptanceMechanisms: any;
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
