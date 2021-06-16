from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v10_presentation_request_requested_attributes import V10PresentationRequestRequestedAttributes
from ..models.v10_presentation_request_requested_predicates import V10PresentationRequestRequestedPredicates
from ..models.v10_presentation_request_self_attested_attributes import V10PresentationRequestSelfAttestedAttributes
from ..types import UNSET, Unset

T = TypeVar("T", bound="V10PresentationRequest")


@attr.s(auto_attribs=True)
class V10PresentationRequest:
    """ """

    requested_attributes: V10PresentationRequestRequestedAttributes
    requested_predicates: V10PresentationRequestRequestedPredicates
    self_attested_attributes: V10PresentationRequestSelfAttestedAttributes
    trace: Union[Unset, bool] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        requested_attributes = self.requested_attributes.to_dict()

        requested_predicates = self.requested_predicates.to_dict()

        self_attested_attributes = self.self_attested_attributes.to_dict()

        trace = self.trace

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "requested_attributes": requested_attributes,
                "requested_predicates": requested_predicates,
                "self_attested_attributes": self_attested_attributes,
            }
        )
        if trace is not UNSET:
            field_dict["trace"] = trace

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        requested_attributes = V10PresentationRequestRequestedAttributes.from_dict(d.pop("requested_attributes"))

        requested_predicates = V10PresentationRequestRequestedPredicates.from_dict(d.pop("requested_predicates"))

        self_attested_attributes = V10PresentationRequestSelfAttestedAttributes.from_dict(
            d.pop("self_attested_attributes")
        )

        trace = d.pop("trace", UNSET)

        v10_presentation_request = cls(
            requested_attributes=requested_attributes,
            requested_predicates=requested_predicates,
            self_attested_attributes=self_attested_attributes,
            trace=trace,
        )

        v10_presentation_request.additional_properties = d
        return v10_presentation_request

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
