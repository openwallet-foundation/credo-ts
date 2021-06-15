from typing import Any, Dict, Union

import httpx

from ...client import Client
from ...models.get_issue_credential_20_records_role import GetIssueCredential20RecordsRole
from ...models.get_issue_credential_20_records_state import GetIssueCredential20RecordsState
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredential20RecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredential20RecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/issue-credential-2.0/records".format(client.base_url)

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


def _build_response(*, response: httpx.Response) -> Response[None]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=None,
    )


def sync_detailed(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredential20RecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredential20RecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Response[None]:
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


async def asyncio_detailed(
    *,
    client: Client,
    connection_id: Union[Unset, str] = UNSET,
    role: Union[Unset, GetIssueCredential20RecordsRole] = UNSET,
    state: Union[Unset, GetIssueCredential20RecordsState] = UNSET,
    thread_id: Union[Unset, str] = UNSET,
) -> Response[None]:
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
