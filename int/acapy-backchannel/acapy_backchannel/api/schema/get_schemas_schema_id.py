from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.schema_get_results import SchemaGetResults
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    schema_id: str,
) -> Dict[str, Any]:
    url = "{}/schemas/{schema_id}".format(client.base_url, schema_id=schema_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[SchemaGetResults]:
    if response.status_code == 200:
        response_200 = SchemaGetResults.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[SchemaGetResults]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    schema_id: str,
) -> Response[SchemaGetResults]:
    kwargs = _get_kwargs(
        client=client,
        schema_id=schema_id,
    )

    response = httpx.get(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    schema_id: str,
) -> Optional[SchemaGetResults]:
    """ """

    return sync_detailed(
        client=client,
        schema_id=schema_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    schema_id: str,
) -> Response[SchemaGetResults]:
    kwargs = _get_kwargs(
        client=client,
        schema_id=schema_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.get(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    schema_id: str,
) -> Optional[SchemaGetResults]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            schema_id=schema_id,
        )
    ).parsed
