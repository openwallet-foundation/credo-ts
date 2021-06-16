from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.attach_decorator_data_jws_header import AttachDecoratorDataJWSHeader
from ..types import UNSET, Unset

T = TypeVar("T", bound="AttachDecoratorData1JWS")


@attr.s(auto_attribs=True)
class AttachDecoratorData1JWS:
    """ """

    header: AttachDecoratorDataJWSHeader
    signature: str
    protected: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        header = self.header.to_dict()

        signature = self.signature
        protected = self.protected

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "header": header,
                "signature": signature,
            }
        )
        if protected is not UNSET:
            field_dict["protected"] = protected

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        header = AttachDecoratorDataJWSHeader.from_dict(d.pop("header"))

        signature = d.pop("signature")

        protected = d.pop("protected", UNSET)

        attach_decorator_data_1jws = cls(
            header=header,
            signature=signature,
            protected=protected,
        )

        attach_decorator_data_1jws.additional_properties = d
        return attach_decorator_data_1jws

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
