// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import {Configuration} from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile} from '../http/http';
import {ObjectSerializer} from '../models/ObjectSerializer';
import {ApiException} from './exception';
import {isCodeInRange} from '../util';

import { ConnRecord } from '../models/ConnRecord';
import { InvitationCreateRequest } from '../models/InvitationCreateRequest';
import { InvitationReceiveRequest } from '../models/InvitationReceiveRequest';
import { InvitationRecord } from '../models/InvitationRecord';

/**
 * no description
 */
export class OutOfBandApiRequestFactory extends BaseAPIRequestFactory {

    /**
     * Create a new connection invitation
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param multiUse Create invitation for multiple use (default false)
     * @param body 
     */
    public async outOfBandCreateInvitationPost(autoAccept?: string, multiUse?: boolean, body?: InvitationCreateRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;




        // Path Params
        const localVarPath = '/out-of-band/create-invitation';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (autoAccept !== undefined) {
            requestContext.setQueryParam("auto_accept", ObjectSerializer.serialize(autoAccept, "string", ""));
        }
        if (multiUse !== undefined) {
            requestContext.setQueryParam("multi_use", ObjectSerializer.serialize(multiUse, "boolean", ""));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "InvitationCreateRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

    /**
     * Receive a new connection invitation
     * @param alias Alias for connection
     * @param autoAccept Auto-accept connection (defaults to configuration)
     * @param mediationId Identifier for active mediation record to be used
     * @param useExistingConnection Use an existing connection, if possible
     * @param body 
     */
    public async outOfBandReceiveInvitationPost(alias?: string, autoAccept?: string, mediationId?: string, useExistingConnection?: boolean, body?: InvitationReceiveRequest, options?: Configuration): Promise<RequestContext> {
        let config = options || this.configuration;






        // Path Params
        const localVarPath = '/out-of-band/receive-invitation';

        // Make Request Context
        const requestContext = config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
        requestContext.setHeaderParam("Accept", "application/json, */*;q=0.8")

        // Query Params
        if (alias !== undefined) {
            requestContext.setQueryParam("alias", ObjectSerializer.serialize(alias, "string", ""));
        }
        if (autoAccept !== undefined) {
            requestContext.setQueryParam("auto_accept", ObjectSerializer.serialize(autoAccept, "string", ""));
        }
        if (mediationId !== undefined) {
            requestContext.setQueryParam("mediation_id", ObjectSerializer.serialize(mediationId, "string", ""));
        }
        if (useExistingConnection !== undefined) {
            requestContext.setQueryParam("use_existing_connection", ObjectSerializer.serialize(useExistingConnection, "boolean", ""));
        }

        // Header Params

        // Form Params


        // Body Params
        const contentType = ObjectSerializer.getPreferredMediaType([
            "application/json"
        ]);
        requestContext.setHeaderParam("Content-Type", contentType);
        const serializedBody = ObjectSerializer.stringify(
            ObjectSerializer.serialize(body, "InvitationReceiveRequest", ""),
            contentType
        );
        requestContext.setBody(serializedBody);

        // Apply auth methods

        return requestContext;
    }

}

export class OutOfBandApiResponseProcessor {

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to outOfBandCreateInvitationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async outOfBandCreateInvitationPost(response: ResponseContext): Promise<InvitationRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: InvitationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "InvitationRecord", ""
            ) as InvitationRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: InvitationRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "InvitationRecord", ""
            ) as InvitationRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

    /**
     * Unwraps the actual response sent by the server from the response context and deserializes the response content
     * to the expected objects
     *
     * @params response Response returned by the server for a request to outOfBandReceiveInvitationPost
     * @throws ApiException if the response code was not in [200, 299]
     */
     public async outOfBandReceiveInvitationPost(response: ResponseContext): Promise<ConnRecord > {
        const contentType = ObjectSerializer.normalizeMediaType(response.headers["content-type"]);
        if (isCodeInRange("200", response.httpStatusCode)) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        // Work around for missing responses in specification, e.g. for petstore.yaml
        if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
            const body: ConnRecord = ObjectSerializer.deserialize(
                ObjectSerializer.parse(await response.body.text(), contentType),
                "ConnRecord", ""
            ) as ConnRecord;
            return body;
        }

        let body = response.body || "";
        throw new ApiException<string>(response.httpStatusCode, "Unknown API Status Code!\nBody: \"" + body + "\"");
    }

}
