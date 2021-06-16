from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.connection_metadata import ConnectionMetadata
from ...models.connection_metadata_set_request import ConnectionMetadataSetRequest
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    conn_id: str,
    json_body: ConnectionMetadataSetRequest,
) -> Dict[str, Any]:
    url = "{}/connections/{conn_id}/metadata".format(client.base_url, conn_id=conn_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    json_json_body = json_body.to_dict()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "json": json_json_body,
    }


def _parse_response(*, response: httpx.Response) -> Optional[ConnectionMetadata]:
    if response.status_code == 200:
        response_200 = ConnectionMetadata.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[ConnectionMetadata]:
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
    json_body: ConnectionMetadataSetRequest,
) -> Response[ConnectionMetadata]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    conn_id: str,
    json_body: ConnectionMetadataSetRequest,
) -> Optional[ConnectionMetadata]:
    """ """

    return sync_detailed(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    conn_id: str,
    json_body: ConnectionMetadataSetRequest,
) -> Response[ConnectionMetadata]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        json_body=json_body,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    conn_id: str,
    json_body: ConnectionMetadataSetRequest,
) -> Optional[ConnectionMetadata]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            conn_id=conn_id,
            json_body=json_body,
        )
    ).parsed
