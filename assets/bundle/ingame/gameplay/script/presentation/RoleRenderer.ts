import { Node, Sprite, SpriteAtlas } from "cc";
import type { GameplayConfig } from "../config/GameplayConfig";
import { BattleState, FighterAction, FighterInfo, FighterState } from "../battle/BattleTypes";

export interface RoleAssetProvider {
    getRoleAtlas(clipId: string): SpriteAtlas;
}

/** 单个角色的坐标插值与序列帧播放，不读取或修改战斗结果。 */
export class RoleRenderer {
    private lastFrame = "";
    declare private node: Node;
    declare private sprite: Sprite;

    init(node: Node, sprite: Sprite) {
        this.node = node;
        this.sprite = sprite;
        this.sprite.sizeMode = Sprite.SizeMode.RAW;
        this.reset();
    }

    render(
        state: BattleState,
        fighter: FighterState,
        info: FighterInfo,
        alpha: number,
        finishElapsed: number,
        config: GameplayConfig,
        assets: RoleAssetProvider,
    ) {
        const view = config.view;
        this.node.setPosition(
            fighter.previousX + (fighter.x - fighter.previousX) * alpha,
            view.actorY,
        );
        const facing = fighter.action === FighterAction.Retreat ? -fighter.facing : fighter.facing;
        const animation = config.getFighterAnimation(info, fighter, state.phase);
        this.node.setScale(facing * (animation.facing ?? 1), 1, 1);
        const frames = config.getFrames(animation.id);
        const elapsed = Math.max(
            0,
            (state.tick - 1 + alpha - fighter.actionFrame) / config.battle.rules.frameRate,
        ) + finishElapsed;
        const index = animation.loop
            ? Math.floor(elapsed * animation.fps) % frames.length
            : Math.min(frames.length - 1, Math.floor(elapsed * animation.fps));
        const key = animation.id + ":" + index;
        if (this.lastFrame === key) return;

        const atlas = assets.getRoleAtlas(animation.id);
        const frameName = animation.id + "_" + String(index).padStart(4, "0");
        const spriteFrame = atlas.getSpriteFrame(frameName);
        if (!spriteFrame) throw new Error("缺少角色帧资源：" + frameName);
        const frame = frames[index]!;
        this.sprite.spriteAtlas = atlas;
        this.sprite.spriteFrame = spriteFrame;
        this.sprite.node.setScale(frame.scale, frame.scale, 1);
        this.sprite.node.setPosition(frame.dx + animation.offsetX, frame.dy + animation.offsetY);
        this.lastFrame = key;
    }

    reset() {
        this.lastFrame = "";
    }
}
