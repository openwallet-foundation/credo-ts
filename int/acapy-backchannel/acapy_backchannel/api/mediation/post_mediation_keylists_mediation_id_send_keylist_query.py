from typing import Any, Dict, Union

import httpx

from ...client import Client
from ...models.keylist_query_filter_request import KeylistQueryFilterRequest
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistQueryFilterRequest,
    paginate_limit: Union[Unset, int] = -1,
    paginate_offset: Union[Unset, int] = 0,
) -> Dict[str, Any]:
    url = "{}/mediation/keylists/{mediation_id}/send-keylist-query".format(client.base_url, mediation_id=mediation_id)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "paginate_limit": paginate_limit,
        "paginate_offset": paginate_offset,
    }
    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    json_json_body = json_body.to_dict()

    return {
        "url": url,
        "headers": headers,
        "cookies": cookies,
        "timeout": client.get_timeout(),
        "json": json_json_body,
        "params": params,
    }


def _build_response(*, response: httpx.Response) -> Response[None]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=None,
    )


def sync_detailed(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistQueryFilterRequest,
    paginate_limit: Union[Unset, int] = -1,
    paginate_offset: Union[Unset, int] = 0,
) -> Response[None]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
        json_body=json_body,
        paginate_limit=paginate_limit,
        paginate_offset=paginate_offset,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


async def asyncio_detailed(
    *,
    client: Client,
    mediation_id: str,
    json_body: KeylistQueryFilterRequest,
    paginate_limit: Union[Unset, int] = -1,
    paginate_offset: Union[Unset, int] = 0,
) -> Response[None]:
    kwargs = _get_kwargs(
        client=client,
        mediation_id=mediation_id,
        json_body=json_body,
        paginate_limit=paginate_limit,
        paginate_offset=paginate_offset,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)
