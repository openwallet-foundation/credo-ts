// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { CredentialDefinitionGetResults } from '../models/CredentialDefinitionGetResults';
import { CredentialDefinitionSendRequest } from '../models/CredentialDefinitionSendRequest';
import { CredentialDefinitionSendResults } from '../models/CredentialDefinitionSendResults';
import { CredentialDefinitionsCreatedResults } from '../models/CredentialDefinitionsCreatedResults';

/**
 * no description
 */
export class CredentialDefinitionApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Search for matching credential definitions that agent originated
     * @param credDefId Credential definition id
     * @param issuerDid Issuer DID
     * @param schemaId Schema identifier
     * @param schemaIssuerDid Schema issuer DID
     * @param schemaName Schema name
     * @param schemaVersion Schema version
     */
    public async credentialDefinitionsCreatedGet(credDefId?: string, issuerDid?: string, schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;







        // Path Params
        const localVarPath = '/credential-definitions/created';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (credDefId !== undefined) {
            requestContext.setQueryParam("cred_def_id", ObjectSerializer.serialize(credDefId, "string", ""));
        }
        if (issuerDid !== undefined) {
            requestContext.setQueryParam("issuer_did", ObjectSerializer.serialize(issuerDid, "string", ""));
        }
        if (schemaId !== undefined) {
            requestContext.setQueryParam("schema_id", ObjectSerializer.serialize(schemaId, "string", ""));
        }
        if (schemaIssuerDid !== undefined) {
            requestContext.setQueryParam("schema_issuer_did", ObjectSerializer.serialize(schemaIssuerDid, "string", ""));
        }
        if (schemaName !== undefined) {
            requestContext.setQueryParam("schema_name", ObjectSerializer.serialize(schemaName, "string", ""));
        }
        if (schemaVersion !== undefined) {
            requestContext.setQueryParam("schema_version", ObjectSerializer.serialize(schemaVersion, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Gets a credential definition from the ledger
     * @param credDefId Credential definition identifier
     */
    public async credentialDefinitionsCredDefIdGet(credDefId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credDefId' is not null or undefined
        if (credDefId === null || credDefId === undefined) {
            throw new RequiredError('Required parameter credDefId was null or undefined when calling credentialDefinitionsCredDefIdGet.');
        }


        // Path Params
        const localVarPath = '/credential-definitions/{cred_def_id}'
            .replace('{' + 'cred_def_id' + '}', encodeURIComponent(String(credDefId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Sends a credential definition to the ledger
     * @param body 
     */
    public async publishCredDef(body?: CredentialDefinitionSendRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/credential-definitions';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "CredentialDefinitionSendRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class CredentialDefinitionApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialDefinitionsCreatedGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialDefinitionsCreatedGet(response: ResponseContext): Promise<CredentialDefinitionsCreatedResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredentialDefinitionsCreatedResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionsCreatedResults", ""
            ) as CredentialDefinitionsCreatedResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredentialDefinitionsCreatedResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionsCreatedResults", ""
            ) as CredentialDefinitionsCreatedResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialDefinitionsCredDefIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialDefinitionsCredDefIdGet(response: ResponseContext): Promise<CredentialDefinitionGetResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredentialDefinitionGetResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionGetResults", ""
            ) as CredentialDefinitionGetResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredentialDefinitionGetResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionGetResults", ""
            ) as CredentialDefinitionGetResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to publishCredDef
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async publishCredDef(response: ResponseContext): Promise<CredentialDefinitionSendResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredentialDefinitionSendResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionSendResults", ""
            ) as CredentialDefinitionSendResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredentialDefinitionSendResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredentialDefinitionSendResults", ""
            ) as CredentialDefinitionSendResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
