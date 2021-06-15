from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.conn_record import ConnRecord

T = TypeVar("T", bound="ConnectionStaticResult")


@attr.s(auto_attribs=True)
class ConnectionStaticResult:
    """ """

    my_verkey: str
    my_did: str
    my_endpoint: str
    record: ConnRecord
    their_did: str
    their_verkey: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        my_verkey = self.my_verkey
        my_did = self.my_did
        my_endpoint = self.my_endpoint
        record = self.record.to_dict()

        their_did = self.their_did
        their_verkey = self.their_verkey

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "my_verkey": my_verkey,
                "my_did": my_did,
                "my_endpoint": my_endpoint,
                "record": record,
                "their_did": their_did,
                "their_verkey": their_verkey,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        my_verkey = d.pop("my_verkey")

        my_did = d.pop("my_did")

        my_endpoint = d.pop("my_endpoint")

        record = ConnRecord.from_dict(d.pop("record"))

        their_did = d.pop("their_did")

        their_verkey = d.pop("their_verkey")

        connection_static_result = cls(
            my_verkey=my_verkey,
            my_did=my_did,
            my_endpoint=my_endpoint,
            record=record,
            their_did=their_did,
            their_verkey=their_verkey,
        )

        connection_static_result.additional_properties = d
        return connection_static_result

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
