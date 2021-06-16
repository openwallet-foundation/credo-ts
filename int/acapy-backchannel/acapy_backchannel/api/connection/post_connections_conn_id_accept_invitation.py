from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.conn_record import ConnRecord
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    conn_id: str,
    mediation_id: Union[Unset, str] = UNSET,
    my_endpoint: Union[Unset, str] = UNSET,
    my_label: Union[Unset, str] = UNSET,
) -> Dict[str, Any]:
    url = "{}/connections/{conn_id}/accept-invitation".format(client.base_url, conn_id=conn_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "mediation_id": mediation_id,
        "my_endpoint": my_endpoint,
        "my_label": my_label,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "params": params,
    }


def _parse_response(*, response: httpx.Response) -> Optional[ConnRecord]:
    if response.status_code == 200:
        response_200 = ConnRecord.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[ConnRecord]:
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
    mediation_id: Union[Unset, str] = UNSET,
    my_endpoint: Union[Unset, str] = UNSET,
    my_label: Union[Unset, str] = UNSET,
) -> Response[ConnRecord]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        mediation_id=mediation_id,
        my_endpoint=my_endpoint,
        my_label=my_label,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    conn_id: str,
    mediation_id: Union[Unset, str] = UNSET,
    my_endpoint: Union[Unset, str] = UNSET,
    my_label: Union[Unset, str] = UNSET,
) -> Optional[ConnRecord]:
    """ """

    return sync_detailed(
        client=client,
        conn_id=conn_id,
        mediation_id=mediation_id,
        my_endpoint=my_endpoint,
        my_label=my_label,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    conn_id: str,
    mediation_id: Union[Unset, str] = UNSET,
    my_endpoint: Union[Unset, str] = UNSET,
    my_label: Union[Unset, str] = UNSET,
) -> Response[ConnRecord]:
    kwargs = _get_kwargs(
        client=client,
        conn_id=conn_id,
        mediation_id=mediation_id,
        my_endpoint=my_endpoint,
        my_label=my_label,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    conn_id: str,
    mediation_id: Union[Unset, str] = UNSET,
    my_endpoint: Union[Unset, str] = UNSET,
    my_label: Union[Unset, str] = UNSET,
) -> Optional[ConnRecord]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            conn_id=conn_id,
            mediation_id=mediation_id,
            my_endpoint=my_endpoint,
            my_label=my_label,
        )
    ).parsed
