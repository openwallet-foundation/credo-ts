from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v10_presentation_exchange_initiator import V10PresentationExchangeInitiator
from ..models.v10_presentation_exchange_presentation import V10PresentationExchangePresentation
from ..models.v10_presentation_exchange_presentation_proposal_dict import (
    V10PresentationExchangePresentationProposalDict,
)
from ..models.v10_presentation_exchange_presentation_request import V10PresentationExchangePresentationRequest
from ..models.v10_presentation_exchange_presentation_request_dict import V10PresentationExchangePresentationRequestDict
from ..models.v10_presentation_exchange_role import V10PresentationExchangeRole
from ..models.v10_presentation_exchange_verified import V10PresentationExchangeVerified
from ..types import UNSET, Unset

T = TypeVar("T", bound="V10PresentationExchange")


@attr.s(auto_attribs=True)
class V10PresentationExchange:
    """ """

    auto_present: Union[Unset, bool] = UNSET
    connection_id: Union[Unset, str] = UNSET
    created_at: Union[Unset, str] = UNSET
    error_msg: Union[Unset, str] = UNSET
    initiator: Union[Unset, V10PresentationExchangeInitiator] = UNSET
    presentation: Union[Unset, V10PresentationExchangePresentation] = UNSET
    presentation_exchange_id: Union[Unset, str] = UNSET
    presentation_proposal_dict: Union[Unset, V10PresentationExchangePresentationProposalDict] = UNSET
    presentation_request: Union[Unset, V10PresentationExchangePresentationRequest] = UNSET
    presentation_request_dict: Union[Unset, V10PresentationExchangePresentationRequestDict] = UNSET
    role: Union[Unset, V10PresentationExchangeRole] = UNSET
    state: Union[Unset, str] = UNSET
    thread_id: Union[Unset, str] = UNSET
    trace: Union[Unset, bool] = UNSET
    updated_at: Union[Unset, str] = UNSET
    verified: Union[Unset, V10PresentationExchangeVerified] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        auto_present = self.auto_present
        connection_id = self.connection_id
        created_at = self.created_at
        error_msg = self.error_msg
        initiator: Union[Unset, str] = UNSET
        if not isinstance(self.initiator, Unset):
            initiator = self.initiator.value

        presentation: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.presentation, Unset):
            presentation = self.presentation.to_dict()

        presentation_exchange_id = self.presentation_exchange_id
        presentation_proposal_dict: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.presentation_proposal_dict, Unset):
            presentation_proposal_dict = self.presentation_proposal_dict.to_dict()

        presentation_request: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.presentation_request, Unset):
            presentation_request = self.presentation_request.to_dict()

        presentation_request_dict: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.presentation_request_dict, Unset):
            presentation_request_dict = self.presentation_request_dict.to_dict()

        role: Union[Unset, str] = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.value

        state = self.state
        thread_id = self.thread_id
        trace = self.trace
        updated_at = self.updated_at
        verified: Union[Unset, str] = UNSET
        if not isinstance(self.verified, Unset):
            verified = self.verified.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if auto_present is not UNSET:
            field_dict["auto_present"] = auto_present
        if connection_id is not UNSET:
            field_dict["connection_id"] = connection_id
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if error_msg is not UNSET:
            field_dict["error_msg"] = error_msg
        if initiator is not UNSET:
            field_dict["initiator"] = initiator
        if presentation is not UNSET:
            field_dict["presentation"] = presentation
        if presentation_exchange_id is not UNSET:
            field_dict["presentation_exchange_id"] = presentation_exchange_id
        if presentation_proposal_dict is not UNSET:
            field_dict["presentation_proposal_dict"] = presentation_proposal_dict
        if presentation_request is not UNSET:
            field_dict["presentation_request"] = presentation_request
        if presentation_request_dict is not UNSET:
            field_dict["presentation_request_dict"] = presentation_request_dict
        if role is not UNSET:
            field_dict["role"] = role
        if state is not UNSET:
            field_dict["state"] = state
        if thread_id is not UNSET:
            field_dict["thread_id"] = thread_id
        if trace is not UNSET:
            field_dict["trace"] = trace
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at
        if verified is not UNSET:
            field_dict["verified"] = verified

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        auto_present = d.pop("auto_present", UNSET)

        connection_id = d.pop("connection_id", UNSET)

        created_at = d.pop("created_at", UNSET)

        error_msg = d.pop("error_msg", UNSET)

        initiator: Union[Unset, V10PresentationExchangeInitiator] = UNSET
        _initiator = d.pop("initiator", UNSET)
        if not isinstance(_initiator, Unset):
            initiator = V10PresentationExchangeInitiator(_initiator)

        presentation: Union[Unset, V10PresentationExchangePresentation] = UNSET
        _presentation = d.pop("presentation", UNSET)
        if not isinstance(_presentation, Unset):
            presentation = V10PresentationExchangePresentation.from_dict(_presentation)

        presentation_exchange_id = d.pop("presentation_exchange_id", UNSET)

        presentation_proposal_dict: Union[Unset, V10PresentationExchangePresentationProposalDict] = UNSET
        _presentation_proposal_dict = d.pop("presentation_proposal_dict", UNSET)
        if not isinstance(_presentation_proposal_dict, Unset):
            presentation_proposal_dict = V10PresentationExchangePresentationProposalDict.from_dict(
                _presentation_proposal_dict
            )

        presentation_request: Union[Unset, V10PresentationExchangePresentationRequest] = UNSET
        _presentation_request = d.pop("presentation_request", UNSET)
        if not isinstance(_presentation_request, Unset):
            presentation_request = V10PresentationExchangePresentationRequest.from_dict(_presentation_request)

        presentation_request_dict: Union[Unset, V10PresentationExchangePresentationRequestDict] = UNSET
        _presentation_request_dict = d.pop("presentation_request_dict", UNSET)
        if not isinstance(_presentation_request_dict, Unset):
            presentation_request_dict = V10PresentationExchangePresentationRequestDict.from_dict(
                _presentation_request_dict
            )

        role: Union[Unset, V10PresentationExchangeRole] = UNSET
        _role = d.pop("role", UNSET)
        if not isinstance(_role, Unset):
            role = V10PresentationExchangeRole(_role)

        state = d.pop("state", UNSET)

        thread_id = d.pop("thread_id", UNSET)

        trace = d.pop("trace", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        verified: Union[Unset, V10PresentationExchangeVerified] = UNSET
        _verified = d.pop("verified", UNSET)
        if not isinstance(_verified, Unset):
            verified = V10PresentationExchangeVerified(_verified)

        v10_presentation_exchange = cls(
            auto_present=auto_present,
            connection_id=connection_id,
            created_at=created_at,
            error_msg=error_msg,
            initiator=initiator,
            presentation=presentation,
            presentation_exchange_id=presentation_exchange_id,
            presentation_proposal_dict=presentation_proposal_dict,
            presentation_request=presentation_request,
            presentation_request_dict=presentation_request_dict,
            role=role,
            state=state,
            thread_id=thread_id,
            trace=trace,
            updated_at=updated_at,
            verified=verified,
        )

        v10_presentation_exchange.additional_properties = d
        return v10_presentation_exchange

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
