from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.publish_revocations_rrid_2_crid import PublishRevocationsRrid2Crid
from ..types import UNSET, Unset

T = TypeVar("T", bound="PublishRevocations")


@attr.s(auto_attribs=True)
class PublishRevocations:
    """ """

    rrid_2_crid: Union[Unset, PublishRevocationsRrid2Crid] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        rrid_2_crid: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.rrid_2_crid, Unset):
            rrid_2_crid = self.rrid_2_crid.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if rrid_2_crid is not UNSET:
            field_dict["rrid2crid"] = rrid_2_crid

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        rrid_2_crid: Union[Unset, PublishRevocationsRrid2Crid] = UNSET
        _rrid_2_crid = d.pop("rrid2crid", UNSET)
        if not isinstance(_rrid_2_crid, Unset):
            rrid_2_crid = PublishRevocationsRrid2Crid.from_dict(_rrid_2_crid)

        publish_revocations = cls(
            rrid_2_crid=rrid_2_crid,
        )

        publish_revocations.additional_properties = d
        return publish_revocations

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
