from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.patch_revocation_registry_rev_reg_id_set_state_state import PatchRevocationRegistryRevRegIdSetStateState
from ...models.rev_reg_result import RevRegResult
from ...types import UNSET, Response


def _get_kwargs(
    *,
    client: Client,
    rev_reg_id: str,
    state: PatchRevocationRegistryRevRegIdSetStateState,
) -> Dict[str, Any]:
    url = "{}/revocation/registry/{rev_reg_id}/set-state".format(client.base_url, rev_reg_id=rev_reg_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_state = state.value

    params: Dict[str, Any] = {
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


def _parse_response(*, response: httpx.Response) -> Optional[RevRegResult]:
    if response.status_code == 200:
        response_200 = RevRegResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[RevRegResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    rev_reg_id: str,
    state: PatchRevocationRegistryRevRegIdSetStateState,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
        state=state,
    )

    response = httpx.patch(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    rev_reg_id: str,
    state: PatchRevocationRegistryRevRegIdSetStateState,
) -> Optional[RevRegResult]:
    """ """

    return sync_detailed(
        client=client,
        rev_reg_id=rev_reg_id,
        state=state,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    rev_reg_id: str,
    state: PatchRevocationRegistryRevRegIdSetStateState,
) -> Response[RevRegResult]:
    kwargs = _get_kwargs(
        client=client,
        rev_reg_id=rev_reg_id,
        state=state,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.patch(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    rev_reg_id: str,
    state: PatchRevocationRegistryRevRegIdSetStateState,
) -> Optional[RevRegResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            rev_reg_id=rev_reg_id,
            state=state,
        )
    ).parsed
