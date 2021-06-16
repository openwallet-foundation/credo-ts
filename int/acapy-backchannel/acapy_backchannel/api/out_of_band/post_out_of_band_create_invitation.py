from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.invitation_create_request import InvitationCreateRequest
from ...models.invitation_record import InvitationRecord
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    json_body: InvitationCreateRequest,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
) -> Dict[str, Any]:
    url = "{}/out-of-band/create-invitation".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "auto_accept": auto_accept,
        "multi_use": multi_use,
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


def _parse_response(*, response: httpx.Response) -> Optional[InvitationRecord]:
    if response.status_code == 200:
        response_200 = InvitationRecord.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[InvitationRecord]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    json_body: InvitationCreateRequest,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
) -> Response[InvitationRecord]:
    kwargs = _get_kwargs(
        client=client,
        json_body=json_body,
        auto_accept=auto_accept,
        multi_use=multi_use,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    json_body: InvitationCreateRequest,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
) -> Optional[InvitationRecord]:
    """ """

    return sync_detailed(
        client=client,
        json_body=json_body,
        auto_accept=auto_accept,
        multi_use=multi_use,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    json_body: InvitationCreateRequest,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
) -> Response[InvitationRecord]:
    kwargs = _get_kwargs(
        client=client,
        json_body=json_body,
        auto_accept=auto_accept,
        multi_use=multi_use,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    json_body: InvitationCreateRequest,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
) -> Optional[InvitationRecord]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            json_body=json_body,
            auto_accept=auto_accept,
            multi_use=multi_use,
        )
    ).parsed
