import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import {
    BattleEventType, BattleInfo, BattlePhase, BattleStepResult,
} from "../model/GameplayTypes";

/** HUD 业务入口：负责头像、名称、血量、回合、行为提示和倍速按钮。 */
export class UiController extends BaseController<GameplayView> {
    private actionExpires = 0;
    private finishElapsed = 0;
    private resultRequested = false;

    /** 使用本场参战数据初始化固定 HUD。 */
    prepare(info: BattleInfo) {
        const view = this.view.config.view;
        for (const fighter of info.fighters) {
            const player = this.view.component.players[fighter.id]!;
            player.portrait.spriteFrame = this.view.assetCtrl.getPortrait(fighter);
            const portraitSize = player.portrait.spriteFrame.originalSize;
            const portraitScale = view.portraitSize / Math.max(portraitSize.width, portraitSize.height);
            player.portrait.node.setScale(portraitScale, portraitScale, 1);
            const showLoadout = fighter.npcId === undefined;
            player.weapons.active = showLoadout;
            player.skills.active = showLoadout;
        }
    }

    /** 将服务指令事件转换为 HUD 行为提示。 */
    onStep(result: BattleStepResult) {
        const view = this.view.config.view;
        for (const event of result.events) {
            let text: string | undefined;
            if (event.type === BattleEventType.Skill) text = this.view.config.getSkill(event.skill!).name;
            else if (event.type === BattleEventType.PutDown) {
                text = this.view.config.format(view.putDownText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.PickUp) {
                text = this.view.config.format(view.pickUpText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Equip) {
                text = this.view.config.format(view.equipText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Throw) {
                text = this.view.config.format(view.throwText, this.view.config.getWeapon(event.weapon!).name);
            } else if (event.type === BattleEventType.Attack) {
                text = this.view.config.getWeapon(event.weapon ?? this.view.config.battle.rules.defaultWeapon).name;
            }
            if (!text) continue;
            this.view.component.actionLabel.string = text;
            this.actionExpires = result.state.tick + view.actionDurationFrames;
        }
    }

    /** 清空上一场 HUD 的临时表现状态。 */
    reset() {
        this.resultRequested = false;
        this.finishElapsed = 0;
        this.actionExpires = 0;
        this.view.component.actionLabel.string = "";
    }

    /** 转发倍速按钮行为给流程入口。 */
    onClickSpeed() {
        this.view.processCtrl.toggleSpeed();
    }

    /** 按当前确定性状态刷新 HUD，并在延时结束后请求结算。 */
    protected override onUpdate(dt: number) {
        const lockstep = this.view.context.lockstep;
        if (!lockstep) return;
        const state = lockstep.state;
        const component = this.view.component;
        const rules = this.view.config.battle.rules;
        component.speedButton.active = !lockstep.finished;
        for (const fighter of state.fighters) {
            const ui = component.players[fighter.id]!;
            ui.hp.fillRange = fighter.hp / fighter.maxHp * (fighter.id === 0 ? 1 : -1);
            ui.health.string = fighter.hp + "/" + fighter.maxHp;
            ui.name.string = this.view.context.info!.fighters[fighter.id]!.name;
        }
        component.roundLabel.string = state.phase === BattlePhase.Countdown
            ? String(Math.max(1, Math.ceil((rules.countdownFrames - state.tick) / rules.frameRate)))
            : this.view.config.format(this.view.config.view.roundText, state.round);
        if (state.tick > this.actionExpires) component.actionLabel.string = "";
        if (lockstep.finished && !lockstep.paused) this.finishElapsed += dt * lockstep.speed;
        if (lockstep.finished && this.finishElapsed > this.view.config.view.resultDelay &&
            !this.resultRequested && !this.view.context.loading) {
            this.resultRequested = true;
            void this.view.openResult().catch((error) => {
                console.error(error);
                component.actionLabel.string = this.view.config.view.loadErrorText;
                this.actionExpires = Number.MAX_SAFE_INTEGER;
            });
        }
    }
}
