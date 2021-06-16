from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="AdminMediationDeny")


@attr.s(auto_attribs=True)
class AdminMediationDeny:
    """ """

    mediator_terms: Union[Unset, List[str]] = UNSET
    recipient_terms: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        mediator_terms: Union[Unset, List[str]] = UNSET
        if not isinstance(self.mediator_terms, Unset):
            mediator_terms = self.mediator_terms

        recipient_terms: Union[Unset, List[str]] = UNSET
        if not isinstance(self.recipient_terms, Unset):
            recipient_terms = self.recipient_terms

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if mediator_terms is not UNSET:
            field_dict["mediator_terms"] = mediator_terms
        if recipient_terms is not UNSET:
            field_dict["recipient_terms"] = recipient_terms

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        mediator_terms = cast(List[str], d.pop("mediator_terms", UNSET))

        recipient_terms = cast(List[str], d.pop("recipient_terms", UNSET))

        admin_mediation_deny = cls(
            mediator_terms=mediator_terms,
            recipient_terms=recipient_terms,
        )

        admin_mediation_deny.additional_properties = d
        return admin_mediation_deny

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
