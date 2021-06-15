from typing import Any, Dict, Optional, Union

import httpx

from ...client import Client
from ...models.create_invitation_request import CreateInvitationRequest
from ...models.invitation_result import InvitationResult
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    client: Client,
    json_body: CreateInvitationRequest,
    alias: Union[Unset, str] = UNSET,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
    public: Union[Unset, bool] = UNSET,
) -> Dict[str, Any]:
    url = "{}/connections/create-invitation".format(client.base_url)

    headers: Dict[str, Any] = client.get_headers()
    cookies: Dict[str, Any] = client.get_cookies()

    params: Dict[str, Any] = {
        "alias": alias,
        "auto_accept": auto_accept,
        "multi_use": multi_use,
        "public": public,
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


def _parse_response(*, response: httpx.Response) -> Optional[InvitationResult]:
    if response.status_code == 200:
        response_200 = InvitationResult.from_dict(response.json())

        return response_200
    return None


def _build_response(*, response: httpx.Response) -> Response[InvitationResult]:
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(response=response),
    )


def sync_detailed(
    *,
    client: Client,
    json_body: CreateInvitationRequest,
    alias: Union[Unset, str] = UNSET,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
    public: Union[Unset, bool] = UNSET,
) -> Response[InvitationResult]:
    kwargs = _get_kwargs(
        client=client,
        json_body=json_body,
        alias=alias,
        auto_accept=auto_accept,
        multi_use=multi_use,
        public=public,
    )

    response = httpx.post(
        **kwargs,
    )

    return _build_response(response=response)


def sync(
    *,
    client: Client,
    json_body: CreateInvitationRequest,
    alias: Union[Unset, str] = UNSET,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
    public: Union[Unset, bool] = UNSET,
) -> Optional[InvitationResult]:
    """ """

    return sync_detailed(
        client=client,
        json_body=json_body,
        alias=alias,
        auto_accept=auto_accept,
        multi_use=multi_use,
        public=public,
    ).parsed


async def asyncio_detailed(
    *,
    client: Client,
    json_body: CreateInvitationRequest,
    alias: Union[Unset, str] = UNSET,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
    public: Union[Unset, bool] = UNSET,
) -> Response[InvitationResult]:
    kwargs = _get_kwargs(
        client=client,
        json_body=json_body,
        alias=alias,
        auto_accept=auto_accept,
        multi_use=multi_use,
        public=public,
    )

    async with httpx.AsyncClient() as _client:
        response = await _client.post(**kwargs)

    return _build_response(response=response)


async def asyncio(
    *,
    client: Client,
    json_body: CreateInvitationRequest,
    alias: Union[Unset, str] = UNSET,
    auto_accept: Union[Unset, str] = UNSET,
    multi_use: Union[Unset, bool] = UNSET,
    public: Union[Unset, bool] = UNSET,
) -> Optional[InvitationResult]:
    """ """

    return (
        await asyncio_detailed(
            client=client,
            json_body=json_body,
            alias=alias,
            auto_accept=auto_accept,
            multi_use=multi_use,
            public=public,
        )
    ).parsed
