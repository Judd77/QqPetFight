import { Color } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleEventType, BattleStepResult } from "../common/GameplayTypes";

/** 飘字业务入口：负责伤害、治疗、闪避和格挡文本表现。 */
export class DamageTextController extends BaseController<GameplayView> {
    private readonly remainingTimes = [0, 0];

    /** 接收一帧逻辑事件并显示对应飘字。 */
    onStep(result: BattleStepResult) {
        const component = this.view.component;
        const view = this.view.config.view;
        for (const event of result.events) {
            if (event.target === undefined ||
                ![BattleEventType.Hit, BattleEventType.Dodge, BattleEventType.Block, BattleEventType.Heal]
                    .includes(event.type)) {
                continue;
            }
            const label = component.damageLabels[event.target]!;
            if (event.type === BattleEventType.Heal) {
                label.string = view.healPrefix + (event.damage ?? 0);
                label.color = Color.fromHEX(new Color(), view.healColor);
            } else if (event.type === BattleEventType.Dodge) {
                label.string = view.dodgeText;
                label.color = Color.fromHEX(new Color(), view.damageColor);
            } else if (event.type === BattleEventType.Block) {
                label.string = view.blockText;
                label.color = Color.fromHEX(new Color(), view.damageColor);
            } else {
                label.string = view.damagePrefix + (event.damage ?? 0);
                label.color = Color.fromHEX(new Color(), event.critical ? view.criticalColor : view.damageColor);
            }
            const target = result.state.fighters[event.target]!;
            label.node.setPosition(target.x, view.damageY);
            label.node.active = true;
            this.remainingTimes[event.target] = view.damageDuration;
        }
    }

    /** 隐藏上一场战斗遗留的飘字。 */
    reset() {
        this.remainingTimes.fill(0);
        for (const label of this.view.component.damageLabels) label.node.active = false;
    }

    /** 逐帧更新飘字上升与消失。 */
    protected override onUpdate(dt: number) {
        const lockstep = this.view.context.lockstep;
        if (!lockstep || this.view.context.loading) return;
        const elapsed = dt * (lockstep.paused ? 0 : lockstep.speed);
        const view = this.view.config.view;
        for (let index = 0; index < this.remainingTimes.length; index++) {
            if (this.remainingTimes[index]! <= 0) continue;
            this.remainingTimes[index] = Math.max(0, this.remainingTimes[index]! - elapsed);
            const node = this.view.component.damageLabels[index]!.node;
            node.setPosition(node.position.x, node.position.y + elapsed * view.damageRiseSpeed);
            node.active = this.remainingTimes[index]! > 0;
        }
    }
}
