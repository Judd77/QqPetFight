import { _decorator, Component, Sprite, UITransform } from "cc";
import { WeaponId } from "../battle/BattleTypes";
const { ccclass } = _decorator;

/** 武器项只保存组件引用与对应的武器 ID。 */
@ccclass("WeaponCellComponent")
export class WeaponCellComponent extends Component {
    declare icon: Sprite;
    declare transform: UITransform;
    weaponId = WeaponId.Fist;

    /** 动态获取通用模板中的组件。 */
    init() {
        this.icon = this.getComponent(Sprite)!;
        this.transform = this.getComponent(UITransform)!;
    }
}
