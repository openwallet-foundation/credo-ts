from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.mediation_record import MediationRecord
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    mediation_id: str,
) -> Dict[str, Any]:
    url = "{}/mediation/{mediation_id}/default-mediator".format(client.base_url, mediation_id=mediation_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
    }


def _parse_response(*, response: httpx.Response) -> Optional[MediationRecord]:
    if response.status_code == 201:
        response_201 = MediationRecord.from_dict(response.json())

        return response_201
    return None


def _build_response(*, response: httpx.Response) -> Response[MediationRecord]:
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
) -> Response[MediationRecord]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
    )

    response = httpx.put(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    mediation_id: str,
) -> Optional[MediationRecord]:
    """ """

    return sync_detailed(
        client=client,
        mediation_id=mediation_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    mediation_id: str,
) -> Response[MediationRecord]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.put(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    mediation_id: str,
) -> Optional[MediationRecord]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            mediation_id=mediation_id,
        )
    ).parsed
