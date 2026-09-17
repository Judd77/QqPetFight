import { _decorator, Component, Sprite } from "cc";
import { SkillId } from "../battle/BattleTypes";
const { ccclass } = _decorator;

/** 技能项只保存组件引用和对应技能，不参与战斗判断。 */
@ccclass("SkillCellComponent")
export class SkillCellComponent extends Component {
    declare icon: Sprite;
    skillId = SkillId.None;

    /** 动态获取通用模板的图片组件。 */
    init() { this.icon = this.getComponent(Sprite)!; }
}
