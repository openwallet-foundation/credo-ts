// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { ClearPendingRevocationsRequest } from '../models/ClearPendingRevocationsRequest';
import { PublishRevocations } from '../models/PublishRevocations';
import { RevRegCreateRequest } from '../models/RevRegCreateRequest';
import { RevRegIssuedResult } from '../models/RevRegIssuedResult';
import { RevRegUpdateTailsFileUri } from '../models/RevRegUpdateTailsFileUri';
import { RevRegsCreated } from '../models/RevRegsCreated';
import { RevokeRequest } from '../models/RevokeRequest';

/**
 * no description
 */
export class RevocationApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Publish pending revocations to ledger
     * @param body 
     */
    public async publishRevocations(body?: PublishRevocations, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/revocation/publish-revocations';

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
            ObjectSerializer.serialize(body, "PublishRevocations", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Get current active revocation registry by credential definition id
     * @param credDefId Credential definition identifier
     */
    public async revocationActiveRegistryCredDefIdGet(credDefId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'credDefId' is not null or undefined
        if (credDefId === null || credDefId === undefined) {
            throw new RequiredError('Required parameter credDefId was null or undefined when calling revocationActiveRegistryCredDefIdGet.');
        }


        // Path Params
        const localVarPath = '/revocation/active-registry/{cred_def_id}'
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
     * Clear pending revocations
     * @param body 
     */
    public async revocationClearPendingRevocationsPost(body?: ClearPendingRevocationsRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/revocation/clear-pending-revocations';

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
            ObjectSerializer.serialize(body, "ClearPendingRevocationsRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Creates a new revocation registry
     * @param body 
     */
    public async revocationCreateRegistryPost(body?: RevRegCreateRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/revocation/create-registry';

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
            ObjectSerializer.serialize(body, "RevRegCreateRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Get credential revocation status
     * @param credExId Credential exchange identifier
     * @param credRevId Credential revocation identifier
     * @param revRegId Revocation registry identifier
     */
    public async revocationCredentialRecordGet(credExId?: string, credRevId?: string, revRegId?: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;




        // Path Params
        const localVarPath = '/revocation/credential-record';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (credExId !== undefined) {
            requestContext.setQueryParam("cred_ex_id", ObjectSerializer.serialize(credExId, "string", ""));
        }
        if (credRevId !== undefined) {
            requestContext.setQueryParam("cred_rev_id", ObjectSerializer.serialize(credRevId, "string", ""));
        }
        if (revRegId !== undefined) {
            requestContext.setQueryParam("rev_reg_id", ObjectSerializer.serialize(revRegId, "string", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Search for matching revocation registries that current agent created
     * @param credDefId Credential definition identifier
     * @param state Revocation registry state
     */
    public async revocationRegistriesCreatedGet(credDefId?: string, state?: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;



        // Path Params
        const localVarPath = '/revocation/registries/created';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (credDefId !== undefined) {
            requestContext.setQueryParam("cred_def_id", ObjectSerializer.serialize(credDefId, "string", ""));
        }
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'init' | 'generated' | 'posted' | 'active' | 'full'", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send revocation registry definition to ledger
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdDefinitionPost(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdDefinitionPost.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/definition'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Send revocation registry entry to ledger
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdEntryPost(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdEntryPost.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/entry'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Get revocation registry by revocation registry id
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdGet(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdGet.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

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
     * Get number of credentials issued against revocation registry
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdIssuedGet(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdIssuedGet.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/issued'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

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
     * Update revocation registry with new public URI to its tails file
     * @param revRegId Revocation Registry identifier
     * @param body 
     */
    public async revocationRegistryRevRegIdPatch(revRegId: string, body?: RevRegUpdateTailsFileUri, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdPatch.');
        }



        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.PATCH);
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
            ObjectSerializer.serialize(body, "RevRegUpdateTailsFileUri", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Set revocation registry state manually
     * @param revRegId Revocation Registry identifier
     * @param state Revocation registry state to set
     */
    public async revocationRegistryRevRegIdSetStatePatch(revRegId: string, state: 'init' | 'generated' | 'posted' | 'active' | 'full', options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdSetStatePatch.');
        }


        // verify required parameter 'state' is not null or undefined
        if (state === null || state === undefined) {
            throw new RequiredError('Required parameter state was null or undefined when calling revocationRegistryRevRegIdSetStatePatch.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/set-state'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.PATCH);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (state !== undefined) {
            requestContext.setQueryParam("state", ObjectSerializer.serialize(state, "'init' | 'generated' | 'posted' | 'active' | 'full'", ""));
        }

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Download tails file
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdTailsFileGet(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdTailsFileGet.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/tails-file'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

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
     * Upload local tails file to server
     * @param revRegId Revocation Registry identifier
     */
    public async revocationRegistryRevRegIdTailsFilePut(revRegId: string, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;

        // verify required parameter 'revRegId' is not null or undefined
        if (revRegId === null || revRegId === undefined) {
            throw new RequiredError('Required parameter revRegId was null or undefined when calling revocationRegistryRevRegIdTailsFilePut.');
        }


        // Path Params
        const localVarPath = '/revocation/registry/{rev_reg_id}/tails-file'
            .replace('{' + 'rev_reg_id' + '}', encodeURIComponent(String(revRegId)));

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.PUT);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params

        // Header Params

        // Form Params


        // Body Params

        // Apply auth methods

        return requestContext;
    }

    /**
     * Revoke an issued credential
     * @param body 
     */
    public async revokeCredential(body?: RevokeRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;


        // Path Params
        const localVarPath = '/revocation/revoke';

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
            ObjectSerializer.serialize(body, "RevokeRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class RevocationApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to publishRevocations
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async publishRevocations(response: ResponseContext): Promise<PublishRevocations > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: PublishRevocations = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PublishRevocations", ""
            ) as PublishRevocations;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: PublishRevocations = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PublishRevocations", ""
            ) as PublishRevocations;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to revocationActiveRegistryCredDefIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationActiveRegistryCredDefIdGet(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationClearPendingRevocationsPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationClearPendingRevocationsPost(response: ResponseContext): Promise<PublishRevocations > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: PublishRevocations = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PublishRevocations", ""
            ) as PublishRevocations;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: PublishRevocations = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "PublishRevocations", ""
            ) as PublishRevocations;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to revocationCreateRegistryPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationCreateRegistryPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationCredentialRecordGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationCredentialRecordGet(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistriesCreatedGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistriesCreatedGet(response: ResponseContext): Promise<RevRegsCreated > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: RevRegsCreated = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "RevRegsCreated", ""
            ) as RevRegsCreated;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: RevRegsCreated = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "RevRegsCreated", ""
            ) as RevRegsCreated;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdDefinitionPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdDefinitionPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdEntryPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdEntryPost(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdGet(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdIssuedGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdIssuedGet(response: ResponseContext): Promise<RevRegIssuedResult > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: RevRegIssuedResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "RevRegIssuedResult", ""
            ) as RevRegIssuedResult;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: RevRegIssuedResult = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "RevRegIssuedResult", ""
            ) as RevRegIssuedResult;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdPatch
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdPatch(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdSetStatePatch
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdSetStatePatch(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdTailsFileGet
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdTailsFileGet(response: ResponseContext): Promise<HttpFile > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: HttpFile = await response.getBodyAsFile() as any as HttpFile;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: HttpFile = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "HttpFile", "binary"
            ) as HttpFile;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to revocationRegistryRevRegIdTailsFilePut
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revocationRegistryRevRegIdTailsFilePut(response: ResponseContext): Promise<any > {
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
     * @params response Response returned by the server for a request to revokeCredential
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async revokeCredential(response: ResponseContext): Promise<any > {
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

}
