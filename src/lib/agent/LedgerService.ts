import logger from '../logger';
import { isIndyError } from '../utils/indyError';
import { Wallet } from '../wallet/Wallet';

export class LedgerService {
  private wallet: Wallet;
  private indy: Indy;
  private poolHandle?: PoolHandle;
  private authorAgreement?: AuthorAgreement | null;

  public constructor(wallet: Wallet, indy: Indy) {
    this.wallet = wallet;
    this.indy = indy;
  }

  public async connect(poolName: string, poolConfig: PoolConfig) {
    try {
      logger.log(`Creating pool config with name "${poolName}".`);
      await this.indy.createPoolLedgerConfig(poolName, poolConfig);
    } catch (error) {
      if (isIndyError(error, 'PoolLedgerConfigAlreadyExistsError')) {
        logger.log(error.indyName);
      } else {
        throw error;
      }
    }

    logger.log('Setting protocol version');
    await this.indy.setProtocolVersion(2);

    logger.log('Opening pool');
    this.poolHandle = await this.indy.openPoolLedger(poolName);
  }

  public async getPublicDid(did: Did) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetNymRequest(null, did);
    logger.log('request', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('response', response);

    const result = await this.indy.parseGetNymResponse(response);
    logger.log('result', result);

    return result;
  }

  public async registerSchema(did: Did, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const { name, attributes, version } = schemaTemplate;
    const [schemaId, schema] = await this.indy.issuerCreateSchema(did, name, version, attributes);
    logger.log(`Register schema with ID = ${schemaId}:`, schema);

    const request = await this.indy.buildSchemaRequest(did, schema);
    logger.log('Register schema request', request);

    const requestWithTaa = await this.appendTaa(request);
    const signedRequest = await this.wallet.signRequest(did, requestWithTaa);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('Register schema response', response);

    return [schemaId, schema];
  }

  public async getCredentialSchema(schemaId: SchemaId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetSchemaRequest(null, schemaId);
    logger.log('Get schema request', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('Get schema response', response);

    const [, schema] = await this.indy.parseGetSchemaResponse(response);
    logger.log('Get schema result: ', schema);

    return schema;
  }

  public async registerCredentialDefinition(
    did: Did,
    credentialDefinitionTemplate: CredDefTemplate
  ): Promise<[CredDefId, CredDef]> {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const { schema, tag, signatureType, config } = credentialDefinitionTemplate;

    const [credDefId, credDef] = await this.wallet.createCredentialDefinition(did, schema, tag, signatureType, config);
    logger.log(`Register credential definition with ID = ${credDefId}:`, credDef);

    const request = await this.indy.buildCredDefRequest(did, credDef);
    logger.log('Register credential definition request:', request);

    const requestWithTaa = await this.appendTaa(request);
    const signedRequest = await this.wallet.signRequest(did, requestWithTaa);

    const response = await this.indy.submitRequest(this.poolHandle, signedRequest);
    logger.log('Register credential definition response:', response);

    return [credDefId, credDef];
  }

  public async getCredentialDefinition(credDefId: CredDefId) {
    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }
    const request = await this.indy.buildGetCredDefRequest(null, credDefId);
    logger.log('Get credential definition request:', request);

    const response = await this.indy.submitRequest(this.poolHandle, request);
    logger.log('Get credential definition response:', response);

    const [, credentialDefinition] = await this.indy.parseGetCredDefResponse(response);
    logger.log('Get credential definition result: ', credentialDefinition);

    return credentialDefinition;
  }

  private async appendTaa(request: LedgerRequest) {
    const authorAgreement = await this.getTransactionAuthorAgreement();

    // If ledger does not have TAA, we can just send request
    if (authorAgreement == null) {
      return request;
    }

    const requestWithTaa = await this.indy.appendTxnAuthorAgreementAcceptanceToRequest(
      request,
      authorAgreement.text,
      authorAgreement.version,
      authorAgreement.digest,
      this.getFirstAcceptanceMechanism(authorAgreement),
      // Current time since epoch
      // We can't use ratification_ts, as it must be greater than 1499906902
      Math.floor(new Date().getTime() / 1000)
    );

    return requestWithTaa;
  }

  private async getTransactionAuthorAgreement(): Promise<AuthorAgreement | null> {
    // TODO Replace this condition with memoization
    if (this.authorAgreement !== undefined) {
      return this.authorAgreement;
    }

    if (!this.poolHandle) {
      throw new Error('Pool has not been initialized.');
    }

    const taaRequest = await this.indy.buildGetTxnAuthorAgreementRequest(null);
    const taaResponse = await this.indy.submitRequest(this.poolHandle, taaRequest);
    const acceptanceMechanismRequest = await this.indy.buildGetAcceptanceMechanismsRequest(null);
    const acceptanceMechanismResponse = await this.indy.submitRequest(this.poolHandle, acceptanceMechanismRequest);

    // TAA can be null
    if (taaResponse.result.data == null) {
      this.authorAgreement = null;
      return null;
    }

    // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
    const authorAgreement = taaResponse.result.data as AuthorAgreement;
    const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms;
    this.authorAgreement = {
      ...authorAgreement,
      acceptanceMechanisms,
    };
    return this.authorAgreement;
  }

  private getFirstAcceptanceMechanism(authorAgreement: AuthorAgreement) {
    const [firstMechanism] = Object.keys(authorAgreement.acceptanceMechanisms.aml);
    return firstMechanism;
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

interface AuthorAgreement {
  digest: string;
  version: string;
  text: string;
  ratification_ts: number;
  acceptanceMechanisms: AcceptanceMechanisms;
}

interface AcceptanceMechanisms {
  aml: Record<string, string>;
  amlContext: string;
  version: string;
}
