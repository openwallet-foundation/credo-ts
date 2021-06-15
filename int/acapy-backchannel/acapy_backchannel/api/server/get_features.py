from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.query_result import QueryResult
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    query: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/features".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "query": query,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[QueryResult]:
    if response.status_code == 200:
        response_200 = QueryResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[QueryResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    query: Union[Unset, str] = UNSET,
) -> Response[QueryResult]:
    kwargs = _get_kwargs(
        client=client,
        query=query,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    query: Union[Unset, str] = UNSET,
) -> Optional[QueryResult]:
    """ """

    return sync_detailed(
        client=client,
        query=query,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    query: Union[Unset, str] = UNSET,
) -> Response[QueryResult]:
    kwargs = _get_kwargs(
        client=client,
        query=query,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    query: Union[Unset, str] = UNSET,
) -> Optional[QueryResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            query=query,
        )
    ).parsed
