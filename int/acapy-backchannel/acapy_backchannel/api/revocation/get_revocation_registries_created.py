from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.get_revocation_registries_created_state import GetRevocationRegistriesCreatedState
from ...models.rev_regs_created import RevRegsCreated
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    state: Union[Unset, GetRevocationRegistriesCreatedState] = UNSET,
) -> Dict[str, Any]:
    url = "{}/revocation/registries/created".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_state: Union[Unset, str] = UNSET
    if not isinstance(state, Unset):
        json_state = state.value

    params: Dict[str, Any] = {
        "cred_def_id": cred_def_id,
        "state": json_state,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[RevRegsCreated]:
    if response.status_code == 200:
        response_200 = RevRegsCreated.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[RevRegsCreated]:
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
    state: Union[Unset, GetRevocationRegistriesCreatedState] = UNSET,
) -> Response[RevRegsCreated]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
        state=state,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    state: Union[Unset, GetRevocationRegistriesCreatedState] = UNSET,
) -> Optional[RevRegsCreated]:
    """ """

    return sync_detailed(
        client=client,
        cred_def_id=cred_def_id,
        state=state,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    state: Union[Unset, GetRevocationRegistriesCreatedState] = UNSET,
) -> Response[RevRegsCreated]:
    kwargs = _get_kwargs(
        client=client,
        cred_def_id=cred_def_id,
        state=state,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    cred_def_id: Union[Unset, str] = UNSET,
    state: Union[Unset, GetRevocationRegistriesCreatedState] = UNSET,
) -> Optional[RevRegsCreated]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            cred_def_id=cred_def_id,
            state=state,
        )
    ).parsed
