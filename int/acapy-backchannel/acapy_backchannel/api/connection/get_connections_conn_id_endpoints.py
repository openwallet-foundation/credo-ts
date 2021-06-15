from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.endpoints_result import EndpointsResult
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    conn_id: str,
) -> Dict[str, Any]:
    url = "{}/connections/{conn_id}/endpoints".format(client.base_url, conn_id=conn_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[EndpointsResult]:
    if response.status_code == 200:
        response_200 = EndpointsResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[EndpointsResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    conn_id: str,
) -> Response[EndpointsResult]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    conn_id: str,
) -> Optional[EndpointsResult]:
    """ """

    return sync_detailed(
        client=client,
        conn_id=conn_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    conn_id: str,
) -> Response[EndpointsResult]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    conn_id: str,
) -> Optional[EndpointsResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            conn_id=conn_id,
        )
    ).parsed
