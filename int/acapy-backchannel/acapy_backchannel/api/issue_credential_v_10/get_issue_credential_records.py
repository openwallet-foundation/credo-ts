from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.get_issue_credential_records_role import GetIssueCredentialRecordsRole
from ...models.get_issue_credential_records_state import GetIssueCredentialRecordsState
from ...models.v10_credential_exchange_list_result import V10CredentialExchangeListResult
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredentialRecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredentialRecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/issue-credential/records".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_role: Union[Unset, str] = UNSET
    if not isinstance(role, Unset):
        json_role = role.value

    json_state: Union[Unset, str] = UNSET
    if not isinstance(state, Unset):
        json_state = state.value

    params: Dict[str, Any] = {
        "connection_id": connection_id,
        "role": json_role,
        "state": json_state,
        "thread_id": thread_id,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[V10CredentialExchangeListResult]:
    if response.status_code == 200:
        response_200 = V10CredentialExchangeListResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[V10CredentialExchangeListResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredentialRecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredentialRecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Response[V10CredentialExchangeListResult]:
    kwargs = _get_kwargs(
        client=client,
        connection_id=connection_id,
        role=role,
        state=state,
        thread_id=thread_id,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredentialRecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredentialRecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Optional[V10CredentialExchangeListResult]:
    """ """

    return sync_detailed(
        client=client,
        connection_id=connection_id,
        role=role,
        state=state,
        thread_id=thread_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredentialRecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredentialRecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Response[V10CredentialExchangeListResult]:
    kwargs = _get_kwargs(
        client=client,
        connection_id=connection_id,
        role=role,
        state=state,
        thread_id=thread_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredentialRecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredentialRecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Optional[V10CredentialExchangeListResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            connection_id=connection_id,
            role=role,
            state=state,
            thread_id=thread_id,
        )
    ).parsed
