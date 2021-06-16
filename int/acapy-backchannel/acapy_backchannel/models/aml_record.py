from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.aml_record_aml import AMLRecordAml
from ..types import UNSET, Unset

T = TypeVar("T", bound="AMLRecord")


@attr.s(auto_attribs=True)
class AMLRecord:
    """ """

    aml: Union[Unset, AMLRecordAml] = UNSET
    aml_context: Union[Unset, str] = UNSET
    version: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        aml: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.aml, Unset):
            aml = self.aml.to_dict()

        aml_context = self.aml_context
        version = self.version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if aml is not UNSET:
            field_dict["aml"] = aml
        if aml_context is not UNSET:
            field_dict["amlContext"] = aml_context
        if version is not UNSET:
            field_dict["version"] = version

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        aml: Union[Unset, AMLRecordAml] = UNSET
        _aml = d.pop("aml", UNSET)
        if not isinstance(_aml, Unset):
            aml = AMLRecordAml.from_dict(_aml)

        aml_context = d.pop("amlContext", UNSET)

        version = d.pop("version", UNSET)

        aml_record = cls(
            aml=aml,
            aml_context=aml_context,
            version=version,
        )

        aml_record.additional_properties = d
        return aml_record

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
