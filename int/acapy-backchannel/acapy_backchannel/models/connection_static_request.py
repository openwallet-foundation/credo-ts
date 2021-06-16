from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="ConnectionStaticRequest")


@attr.s(auto_attribs=True)
class ConnectionStaticRequest:
    """ """

    alias: Union[Unset, str] = UNSET
    my_did: Union[Unset, str] = UNSET
    my_seed: Union[Unset, str] = UNSET
    their_did: Union[Unset, str] = UNSET
    their_endpoint: Union[Unset, str] = UNSET
    their_label: Union[Unset, str] = UNSET
    their_seed: Union[Unset, str] = UNSET
    their_verkey: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        alias = self.alias
        my_did = self.my_did
        my_seed = self.my_seed
        their_did = self.their_did
        their_endpoint = self.their_endpoint
        their_label = self.their_label
        their_seed = self.their_seed
        their_verkey = self.their_verkey

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if alias is not UNSET:
            field_dict["alias"] = alias
        if my_did is not UNSET:
            field_dict["my_did"] = my_did
        if my_seed is not UNSET:
            field_dict["my_seed"] = my_seed
        if their_did is not UNSET:
            field_dict["their_did"] = their_did
        if their_endpoint is not UNSET:
            field_dict["their_endpoint"] = their_endpoint
        if their_label is not UNSET:
            field_dict["their_label"] = their_label
        if their_seed is not UNSET:
            field_dict["their_seed"] = their_seed
        if their_verkey is not UNSET:
            field_dict["their_verkey"] = their_verkey

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        alias = d.pop("alias", UNSET)

        my_did = d.pop("my_did", UNSET)

        my_seed = d.pop("my_seed", UNSET)

        their_did = d.pop("their_did", UNSET)

        their_endpoint = d.pop("their_endpoint", UNSET)

        their_label = d.pop("their_label", UNSET)

        their_seed = d.pop("their_seed", UNSET)

        their_verkey = d.pop("their_verkey", UNSET)

        connection_static_request = cls(
            alias=alias,
            my_did=my_did,
            my_seed=my_seed,
            their_did=their_did,
            their_endpoint=their_endpoint,
            their_label=their_label,
            their_seed=their_seed,
            their_verkey=their_verkey,
        )

        connection_static_request.additional_properties = d
        return connection_static_request

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
