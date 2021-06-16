// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { SchemaGetResults } from '../models/SchemaGetResults';
import { SchemaSendRequest } from '../models/SchemaSendRequest';
import { SchemaSendResults } from '../models/SchemaSendResults';
import { SchemasCreatedResults } from '../models/SchemasCreatedResults';

/**
 * no description
 */
export class SchemaApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Sends a schema to the ledger
     * @param body 
     */
    public async publishSchema(body?: SchemaSendRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/schemas';

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
            ObjectSerializer.serialize(body, "SchemaSendRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Search for matching schema that agent originated
     * @param schemaId Schema identifier
     * @param schemaIssuerDid Schema issuer DID
     * @param schemaName Schema name
     * @param schemaVersion Schema version
     */
    public async schemasCreatedGet(schemaId?: string, schemaIssuerDid?: string, schemaName?: string, schemaVersion?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;





        // Path Params
        const localVarPath = '/schemas/created';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
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
     * Gets a schema from the ledger
     * @param schemaId Schema identifier
     */
    public async schemasSchemaIdGet(schemaId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'schemaId' is not null or undefined
        if (schemaId === null || schemaId === undefined) {
            throw new RequiredError('Required parameter schemaId was null or undefined when calling schemasSchemaIdGet.');
        }


        // Path Params
        const localVarPath = '/schemas/{schema_id}'
            .replace('{' + 'schema_id' + '}', encodeURIComponent(String(schemaId)));

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

}

export class SchemaApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to publishSchema
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async publishSchema(response: ResponseContext): Promise<SchemaSendResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: SchemaSendResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemaSendResults", ""
            ) as SchemaSendResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: SchemaSendResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemaSendResults", ""
            ) as SchemaSendResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to schemasCreatedGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async schemasCreatedGet(response: ResponseContext): Promise<SchemasCreatedResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: SchemasCreatedResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemasCreatedResults", ""
            ) as SchemasCreatedResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: SchemasCreatedResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemasCreatedResults", ""
            ) as SchemasCreatedResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to schemasSchemaIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async schemasSchemaIdGet(response: ResponseContext): Promise<SchemaGetResults > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: SchemaGetResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemaGetResults", ""
            ) as SchemaGetResults;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: SchemaGetResults = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "SchemaGetResults", ""
            ) as SchemaGetResults;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
