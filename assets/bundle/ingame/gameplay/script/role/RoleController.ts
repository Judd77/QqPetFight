import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattlePhase } from "../common/GameplayTypes";
import type { BattleStepResult } from "../common/GameplayTypes";
import { RoleAudio } from "./RoleAudio";
import { RolePresentation } from "./RolePresentation";

/** 角色业务入口：负责角色动作、位置插值与前后层级。 */
export class RoleController extends BaseController<GameplayView> {
    private readonly roles = [new RolePresentation(), new RolePresentation()];
    private readonly audio = new RoleAudio(this.view);
    private prepared = false;
    private finishElapsed = 0;

    /** 将角色表现对象绑定到当前场景动态获取的节点。 */
    prepare() {
        const component = this.view.component;
        for (let index = 0; index < this.roles.length; index++) {
            this.roles[index]!.init(component.actors[index]!, component.actorSprites[index]!);
        }
        this.prepared = true;
    }

    /** 清空上一场战斗的角色表现进度。 */
    reset() {
        this.finishElapsed = 0;
        this.audio.reset();
        for (const role of this.roles) role.reset();
    }

    /** 消费角色移动、闪避和胜负语音事件。 */
    onStep(result: BattleStepResult) {
        this.audio.onStep(result);
    }

    /** 根据当前锁步状态渲染角色，不参与战斗结果计算。 */
    protected override onUpdate(dt: number) {
        const lockstep = this.view.context.lockstep;
        if (!lockstep || !this.prepared || this.view.context.loading) return;
        const speed = lockstep.paused ? 0 : lockstep.speed;
        if (lockstep.state.phase === BattlePhase.Finished) this.finishElapsed += dt * speed;
        this.updateLayer(lockstep.state.activePlayer);
        for (const fighter of lockstep.state.fighters) {
            this.roles[fighter.id]!.render(
                lockstep.state,
                fighter,
                this.view.context.info!.fighters[fighter.id]!,
                lockstep.interpolationAlpha,
                this.finishElapsed,
                this.view.config,
                this.view.assetCtrl,
            );
        }
    }

    /** 保证行动方始终显示在被攻击方上层。 */
    private updateLayer(activePlayer: number) {
        const actors = this.view.component.actors;
        const attacker = actors[activePlayer]!;
        const defender = actors[1 - activePlayer]!;
        const attackerIndex = attacker.getSiblingIndex();
        const defenderIndex = defender.getSiblingIndex();
        if (attackerIndex > defenderIndex) return;
        attacker.setSiblingIndex(defenderIndex);
        defender.setSiblingIndex(attackerIndex);
    }

    protected override onUnload() {
        this.prepared = false;
    }
}
