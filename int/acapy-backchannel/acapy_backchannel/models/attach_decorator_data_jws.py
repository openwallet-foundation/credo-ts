from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.attach_decorator_data_1jws import AttachDecoratorData1JWS
from ..models.attach_decorator_data_jws_header import AttachDecoratorDataJWSHeader
from ..types import UNSET, Unset

T = TypeVar("T", bound="AttachDecoratorDataJWS")


@attr.s(auto_attribs=True)
class AttachDecoratorDataJWS:
    """ """

    header: Union[Unset, AttachDecoratorDataJWSHeader] = UNSET
    protected: Union[Unset, str] = UNSET
    signature: Union[Unset, str] = UNSET
    signatures: Union[Unset, List[AttachDecoratorData1JWS]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        header: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.header, Unset):
            header = self.header.to_dict()

        protected = self.protected
        signature = self.signature
        signatures: Union[Unset, List[Dict[str, Any]]] = UNSET
        if not isinstance(self.signatures, Unset):
            signatures = []
            for signatures_item_data in self.signatures:
                signatures_item = signatures_item_data.to_dict()

                signatures.append(signatures_item)

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if header is not UNSET:
            field_dict["header"] = header
        if protected is not UNSET:
            field_dict["protected"] = protected
        if signature is not UNSET:
            field_dict["signature"] = signature
        if signatures is not UNSET:
            field_dict["signatures"] = signatures

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        header: Union[Unset, AttachDecoratorDataJWSHeader] = UNSET
        _header = d.pop("header", UNSET)
        if not isinstance(_header, Unset):
            header = AttachDecoratorDataJWSHeader.from_dict(_header)

        protected = d.pop("protected", UNSET)

        signature = d.pop("signature", UNSET)

        signatures = []
        _signatures = d.pop("signatures", UNSET)
        for signatures_item_data in _signatures or []:
            signatures_item = AttachDecoratorData1JWS.from_dict(signatures_item_data)

            signatures.append(signatures_item)

        attach_decorator_data_jws = cls(
            header=header,
            protected=protected,
            signature=signature,
            signatures=signatures,
        )

        attach_decorator_data_jws.additional_properties = d
        return attach_decorator_data_jws

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
