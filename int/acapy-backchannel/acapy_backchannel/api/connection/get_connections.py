from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.connection_list import ConnectionList
from ...models.get_connections_state import GetConnectionsState
from ...models.get_connections_their_role import GetConnectionsTheirRole
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    alias: Union[Unset, str] = UNSET,
    invitation_key: Union[Unset, str] = UNSET,
    my_did: Union[Unset, str] = UNSET,
    state: Union[Unset, GetConnectionsState] = UNSET,
    their_did: Union[Unset, str] = UNSET,
    their_role: Union[Unset, GetConnectionsTheirRole] = UNSET,
) -> Dict[str, Any]:
    url = "{}/connections".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_state: Union[Unset, str] = UNSET
    if not isinstance(state, Unset):
        json_state = state.value

    json_their_role: Union[Unset, str] = UNSET
    if not isinstance(their_role, Unset):
        json_their_role = their_role.value

    params: Dict[str, Any] = {
        "alias": alias,
        "invitation_key": invitation_key,
        "my_did": my_did,
        "state": json_state,
        "their_did": their_did,
        "their_role": json_their_role,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[ConnectionList]:
    if response.status_code == 200:
        response_200 = ConnectionList.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[ConnectionList]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    alias: Union[Unset, str] = UNSET,
    invitation_key: Union[Unset, str] = UNSET,
    my_did: Union[Unset, str] = UNSET,
    state: Union[Unset, GetConnectionsState] = UNSET,
    their_did: Union[Unset, str] = UNSET,
    their_role: Union[Unset, GetConnectionsTheirRole] = UNSET,
) -> Response[ConnectionList]:
    kwargs = _get_kwargs(
        client=client,
        alias=alias,
        invitation_key=invitation_key,
        my_did=my_did,
        state=state,
        their_did=their_did,
        their_role=their_role,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    alias: Union[Unset, str] = UNSET,
    invitation_key: Union[Unset, str] = UNSET,
    my_did: Union[Unset, str] = UNSET,
    state: Union[Unset, GetConnectionsState] = UNSET,
    their_did: Union[Unset, str] = UNSET,
    their_role: Union[Unset, GetConnectionsTheirRole] = UNSET,
) -> Optional[ConnectionList]:
    """ """

    return sync_detailed(
        client=client,
        alias=alias,
        invitation_key=invitation_key,
        my_did=my_did,
        state=state,
        their_did=their_did,
        their_role=their_role,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    alias: Union[Unset, str] = UNSET,
    invitation_key: Union[Unset, str] = UNSET,
    my_did: Union[Unset, str] = UNSET,
    state: Union[Unset, GetConnectionsState] = UNSET,
    their_did: Union[Unset, str] = UNSET,
    their_role: Union[Unset, GetConnectionsTheirRole] = UNSET,
) -> Response[ConnectionList]:
    kwargs = _get_kwargs(
        client=client,
        alias=alias,
        invitation_key=invitation_key,
        my_did=my_did,
        state=state,
        their_did=their_did,
        their_role=their_role,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    alias: Union[Unset, str] = UNSET,
    invitation_key: Union[Unset, str] = UNSET,
    my_did: Union[Unset, str] = UNSET,
    state: Union[Unset, GetConnectionsState] = UNSET,
    their_did: Union[Unset, str] = UNSET,
    their_role: Union[Unset, GetConnectionsTheirRole] = UNSET,
) -> Optional[ConnectionList]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            alias=alias,
            invitation_key=invitation_key,
            my_did=my_did,
            state=state,
            their_did=their_did,
            their_role=their_role,
        )
    ).parsed
