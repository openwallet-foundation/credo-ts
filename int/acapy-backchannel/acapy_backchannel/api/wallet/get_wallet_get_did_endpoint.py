from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.did_endpoint import DIDEndpoint
from ...types import UNSET, Response


def _get_kwargs(
    *,
    client: Client,
    did: str,
) -> Dict[str, Any]:
    url = "{}/wallet/get-did-endpoint".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "did": did,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[DIDEndpoint]:
    if response.status_code == 200:
        response_200 = DIDEndpoint.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[DIDEndpoint]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    did: str,
) -> Response[DIDEndpoint]:
    kwargs = _get_kwargs(
        client=client,
        did=did,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    did: str,
) -> Optional[DIDEndpoint]:
    """ """

    return sync_detailed(
        client=client,
        did=did,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    did: str,
) -> Response[DIDEndpoint]:
    kwargs = _get_kwargs(
        client=client,
        did=did,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    did: str,
) -> Optional[DIDEndpoint]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            did=did,
        )
    ).parsed
