from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.credential_definition import CredentialDefinition
from ..types import UNSET, Unset

T = TypeVar("T", bound="CredentialDefinitionGetResults")


@attr.s(auto_attribs=True)
class CredentialDefinitionGetResults:
    """ """

    credential_definition: Union[Unset, CredentialDefinition] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        credential_definition: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.credential_definition, Unset):
            credential_definition = self.credential_definition.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if credential_definition is not UNSET:
            field_dict["credential_definition"] = credential_definition

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        credential_definition: Union[Unset, CredentialDefinition] = UNSET
        _credential_definition = d.pop("credential_definition", UNSET)
        if not isinstance(_credential_definition, Unset):
            credential_definition = CredentialDefinition.from_dict(_credential_definition)

        credential_definition_get_results = cls(
            credential_definition=credential_definition,
        )

        credential_definition_get_results.additional_properties = d
        return credential_definition_get_results

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
