// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { CredBrief } from '../models/CredBrief';
import { CredBriefList } from '../models/CredBriefList';
import { CredRevokedResult } from '../models/CredRevokedResult';

/**
 * no description
 */
export class CredentialsApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Remove a credential from the wallet by id
     * @param credentialId Credential identifier
     */
    public async credentialCredentialIdDelete(credentialId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credentialId' is not null or undefined
        if (credentialId === null || credentialId === undefined) {
            throw new RequiredError('Required parameter credentialId was null or undefined when calling credentialCredentialIdDelete.');
        }


        // Path Params
        const localVarPath = '/credential/{credential_id}'
            .replace('{' + 'credential_id' + '}', encodeURIComponent(String(credentialId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch a credential from wallet by id
     * @param credentialId Credential identifier
     */
    public async credentialCredentialIdGet(credentialId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credentialId' is not null or undefined
        if (credentialId === null || credentialId === undefined) {
            throw new RequiredError('Required parameter credentialId was null or undefined when calling credentialCredentialIdGet.');
        }


        // Path Params
        const localVarPath = '/credential/{credential_id}'
            .replace('{' + 'credential_id' + '}', encodeURIComponent(String(credentialId)));

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
     * Get attribute MIME types from wallet
     * @param credentialId Credential identifier
     */
    public async credentialMimeTypesCredentialIdGet(credentialId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credentialId' is not null or undefined
        if (credentialId === null || credentialId === undefined) {
            throw new RequiredError('Required parameter credentialId was null or undefined when calling credentialMimeTypesCredentialIdGet.');
        }


        // Path Params
        const localVarPath = '/credential/mime-types/{credential_id}'
            .replace('{' + 'credential_id' + '}', encodeURIComponent(String(credentialId)));

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
     * Query credential revocation status by id
     * @param credentialId Credential identifier
     * @param from Earliest epoch of revocation status interval of interest
     * @param to Latest epoch of revocation status interval of interest
     */
    public async credentialRevokedCredentialIdGet(credentialId: string, from?: string, to?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credentialId' is not null or undefined
        if (credentialId === null || credentialId === undefined) {
            throw new RequiredError('Required parameter credentialId was null or undefined when calling credentialRevokedCredentialIdGet.');
        }




        // Path Params
        const localVarPath = '/credential/revoked/{credential_id}'
            .replace('{' + 'credential_id' + '}', encodeURIComponent(String(credentialId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (from !== undefined) {
            requestContext.setQueryParam("from", ObjectSerializer.serialize(from, "string", ""));
        }
        if (to !== undefined) {
            requestContext.setQueryParam("to", ObjectSerializer.serialize(to, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Fetch credentials from wallet
     * @param count Maximum number to retrieve
     * @param start Start index
     * @param wql (JSON) WQL query
     */
    public async credentialsGet(count?: string, start?: string, wql?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;




        // Path Params
        const localVarPath = '/credentials';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (count !== undefined) {
            requestContext.setQueryParam("count", ObjectSerializer.serialize(count, "string", ""));
        }
        if (start !== undefined) {
            requestContext.setQueryParam("start", ObjectSerializer.serialize(start, "string", ""));
        }
        if (wql !== undefined) {
            requestContext.setQueryParam("wql", ObjectSerializer.serialize(wql, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

}

export class CredentialsApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialCredentialIdDelete
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialCredentialIdDelete(response: ResponseContext): Promise<any > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialCredentialIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialCredentialIdGet(response: ResponseContext): Promise<CredBrief > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredBrief = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredBrief", ""
            ) as CredBrief;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredBrief = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredBrief", ""
            ) as CredBrief;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialMimeTypesCredentialIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialMimeTypesCredentialIdGet(response: ResponseContext): Promise<any > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: any = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "any", ""
            ) as any;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialRevokedCredentialIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialRevokedCredentialIdGet(response: ResponseContext): Promise<CredRevokedResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredRevokedResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredRevokedResult", ""
            ) as CredRevokedResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredRevokedResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredRevokedResult", ""
            ) as CredRevokedResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to credentialsGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async credentialsGet(response: ResponseContext): Promise<CredBriefList > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: CredBriefList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredBriefList", ""
            ) as CredBriefList;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: CredBriefList = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "CredBriefList", ""
            ) as CredBriefList;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
