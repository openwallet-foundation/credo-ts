from typing import Any, Dict, Optional

import httpx

from ...client import Client
from ...models.admin_mediation_deny import AdminMediationDeny
from ...models.mediation_deny import MediationDeny
from ...types import Response


def _get_kwargs(
    *,
    client: Client,
    mediation_id: str,
    json_body: AdminMediationDeny,
) -> Dict[str, Any]:
    url = "{}/mediation/requests/{mediation_id}/deny".format(client.base_url, mediation_id=mediation_id)

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


def _parse_response(*, response: httpx.Response) -> Optional[MediationDeny]:
    if response.status_code == 201:
        response_201 = MediationDeny.from_dict(response.json())

        return response_201
    return None


def _build_response(*, response: httpx.Response) -> Response[MediationDeny]:
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
    json_body: AdminMediationDeny,
) -> Response[MediationDeny]:
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
    json_body: AdminMediationDeny,
) -> Optional[MediationDeny]:
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
    json_body: AdminMediationDeny,
) -> Response[MediationDeny]:
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
    json_body: AdminMediationDeny,
) -> Optional[MediationDeny]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            mediation_id=mediation_id,
            json_body=json_body,
        )
    ).parsed
