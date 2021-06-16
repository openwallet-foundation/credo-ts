from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.credential_definitions_created_results import CredentialDefinitionsCreatedResults
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    issuer_did: Union[Unset, str] = UNSET,
    schema_id: Union[Unset, str] = UNSET,
    schema_issuer_did: Union[Unset, str] = UNSET,
    schema_name: Union[Unset, str] = UNSET,
    schema_version: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/credential-definitions/created".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "cred_def_id": cred_def_id,
        "issuer_did": issuer_did,
        "schema_id": schema_id,
        "schema_issuer_did": schema_issuer_did,
        "schema_name": schema_name,
        "schema_version": schema_version,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[CredentialDefinitionsCreatedResults]:
    if response.status_code == 200:
        response_200 = CredentialDefinitionsCreatedResults.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[CredentialDefinitionsCreatedResults]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    issuer_did: Union[Unset, str] = UNSET,
    schema_id: Union[Unset, str] = UNSET,
    schema_issuer_did: Union[Unset, str] = UNSET,
    schema_name: Union[Unset, str] = UNSET,
    schema_version: Union[Unset, str] = UNSET,
) -> Response[CredentialDefinitionsCreatedResults]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
        issuer_did=issuer_did,
        schema_id=schema_id,
        schema_issuer_did=schema_issuer_did,
        schema_name=schema_name,
        schema_version=schema_version,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    issuer_did: Union[Unset, str] = UNSET,
    schema_id: Union[Unset, str] = UNSET,
    schema_issuer_did: Union[Unset, str] = UNSET,
    schema_name: Union[Unset, str] = UNSET,
    schema_version: Union[Unset, str] = UNSET,
) -> Optional[CredentialDefinitionsCreatedResults]:
    """ """

    return sync_detailed(
        client=client,
        cred_def_id=cred_def_id,
        issuer_did=issuer_did,
        schema_id=schema_id,
        schema_issuer_did=schema_issuer_did,
        schema_name=schema_name,
        schema_version=schema_version,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    issuer_did: Union[Unset, str] = UNSET,
    schema_id: Union[Unset, str] = UNSET,
    schema_issuer_did: Union[Unset, str] = UNSET,
    schema_name: Union[Unset, str] = UNSET,
    schema_version: Union[Unset, str] = UNSET,
) -> Response[CredentialDefinitionsCreatedResults]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
        issuer_did=issuer_did,
        schema_id=schema_id,
        schema_issuer_did=schema_issuer_did,
        schema_name=schema_name,
        schema_version=schema_version,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    issuer_did: Union[Unset, str] = UNSET,
    schema_id: Union[Unset, str] = UNSET,
    schema_issuer_did: Union[Unset, str] = UNSET,
    schema_name: Union[Unset, str] = UNSET,
    schema_version: Union[Unset, str] = UNSET,
) -> Optional[CredentialDefinitionsCreatedResults]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            cred_def_id=cred_def_id,
            issuer_did=issuer_did,
            schema_id=schema_id,
            schema_issuer_did=schema_issuer_did,
            schema_name=schema_name,
            schema_version=schema_version,
        )
    ).parsed
