from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.did_posture import DIDPosture

T = TypeVar("T", bound="DID")


@attr.s(auto_attribs=True)
class DID:
    """ """

    did: str
    posture: DIDPosture
    verkey: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        did = self.did
        posture = self.posture.value

        verkey = self.verkey

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "did": did,
                "posture": posture,
                "verkey": verkey,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        did = d.pop("did")

        posture = DIDPosture(d.pop("posture"))

        verkey = d.pop("verkey")

        did = cls(
            did=did,
            posture=posture,
            verkey=verkey,
        )

        did.additional_properties = d
        return did

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
