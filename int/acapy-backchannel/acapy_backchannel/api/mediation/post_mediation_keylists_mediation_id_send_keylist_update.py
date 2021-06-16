from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.keylist_update import KeylistUpdate
from ...models.keylist_update_request import KeylistUpdateRequest
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistUpdateRequest,
) -> Dict[str, Any]:
    url = "{}/mediation/keylists/{mediation_id}/send-keylist-update".format(client.base_url, mediation_id=mediation_id)

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


def _parse_response(*, response: httpx.Response) -> Optional[KeylistUpdate]:
    if response.status_code == 201:
        response_201 = KeylistUpdate.from_dict(response.json())

        return response_201
    return None


def _build_response(*, response: httpx.Response) -> Response[KeylistUpdate]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistUpdateRequest,
) -> Response[KeylistUpdate]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
        json_body=json_body,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistUpdateRequest,
) -> Optional[KeylistUpdate]:
    """ """

    return sync_detailed(
        client=client,
        mediation_id=mediation_id,
        json_body=json_body,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistUpdateRequest,
) -> Response[KeylistUpdate]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
        json_body=json_body,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistUpdateRequest,
) -> Optional[KeylistUpdate]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            mediation_id=mediation_id,
            json_body=json_body,
        )
    ).parsed
