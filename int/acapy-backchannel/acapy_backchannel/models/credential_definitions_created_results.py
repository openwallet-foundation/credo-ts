from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="CredentialDefinitionsCreatedResults")


@attr.s(auto_attribs=True)
class CredentialDefinitionsCreatedResults:
    """ """

    credential_definition_ids: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        credential_definition_ids: Union[Unset, List[str]] = UNSET
        if not isinstance(self.credential_definition_ids, Unset):
            credential_definition_ids = self.credential_definition_ids

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if credential_definition_ids is not UNSET:
            field_dict["credential_definition_ids"] = credential_definition_ids

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        credential_definition_ids = cast(List[str], d.pop("credential_definition_ids", UNSET))

        credential_definitions_created_results = cls(
            credential_definition_ids=credential_definition_ids,
        )

        credential_definitions_created_results.additional_properties = d
        return credential_definitions_created_results

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
