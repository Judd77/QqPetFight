import { SpriteAtlas, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleInfo, FighterGender, SKILLS, WeaponId, WEAPONS } from "../battle/BattleTypes";
import type { BattleWorld } from "../battle/BattleWorld";
import { BattlePresentation } from "../presentation/BattlePresentation";

import type { Tables } from "db://assets/bundle/shared/script/schema/Schema";
import type { RoleFrameEntry } from "db://assets/bundle/shared/script/schema/Schema";

const ASSET_ROOT = "ingame/gameplay/texture/";

/** 按本场角色和装备加载原版动作，不预加载整个素材库。 */
export class PresentationController extends BaseController<GameplayView> {
    private presentation?: BattlePresentation;
    private declare tables: Tables;
    private readonly frames = new Map<string, RoleFrameEntry[]>();
    private readonly atlases = new Map<string, SpriteAtlas>();
    private readonly portraits = new Map<FighterGender, SpriteFrame>();

    /** 加载 Luban 配置并整理角色帧数据。 */
    protected override async onLoad() {
        this.tables = this.view.serve.configService.tables;
        this.frames.clear();
        for (const frame of this.tables.TbRoleFrame.getDataList()) {
            let frames = this.frames.get(frame.clipId);
            if (!frames) this.frames.set(frame.clipId, frames = []);
            if (frames[frame.index]) throw new Error("角色帧重复：" + frame.clipId + ":" + frame.index);
            frames[frame.index] = frame;
        }
    }

    /** 完整准备这一场的图片后，再切换动作帧与头像。 */
    async prepare(info: BattleInfo, onProgress?: (progress: number) => void) {
        const keys = this.getClipKeys(info);
        let completed = 0;
        const total = keys.size + new Set(info.fighters.map((fighter) => fighter.gender)).size + 1;
        const advance = () => onProgress?.(++completed / total);
        // 失败时也保留已经成功加载的资源，重试只补齐缺失项。
        const results = await Promise.allSettled(Array.from(keys).map(async (key) => {
            if (this.atlases.has(key)) { advance(); return; }
            if (!this.tables.TbRoleAnimation.get(key)) throw new Error("缺少角色动作：" + key);
            const atlas = await this.view.serve.assetService.load(ASSET_ROOT + "role/" + key, SpriteAtlas);
            atlas.addRef();
            this.atlases.set(key, atlas);
            advance();
        }));
        const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
        await this.preparePortraits(info, advance);
        const state = this.view.component;
        this.presentation?.dispose();
        this.presentation = new BattlePresentation();
        this.presentation.init(state.worldRoot, this.tables.TbRoleAnimation, this.frames, this.atlases, state.weaponFrames);
        for (const fighter of info.fighters) {
            const portrait = state.players[fighter.id]!.portrait;
            portrait.spriteFrame = this.portraits.get(fighter.gender)!;
            const size = portrait.spriteFrame.originalSize;
            const scale = 78 / Math.max(size.width, size.height);
            portrait.node.setScale(scale, scale, 1);
        }
        advance();
    }

    /** 收集实际可达的动作；没有携带的武器和技能不加载。 */
    private getClipKeys(info: BattleInfo) {
        const keys = new Set<string>();
        for (const fighter of info.fighters) {
            const prefix = fighter.gender === FighterGender.Male ? "male-" : "";
            for (const weapon of [WeaponId.Fist, ...fighter.weapons]) {
                const variant = WEAPONS[weapon].role;
                if (WEAPONS[weapon].isRanged) {
                    // 飞刀取出后即投掷，当前状态机不会持刀跑步或使用技能。
                    for (const action of ["equip", "throw", "win", "lose"]) keys.add(prefix + variant + "-" + action);
                    continue;
                }
                for (const action of ["idle", "run", "dodge", "hurt", "win", "lose",
                    weapon === WeaponId.Fist ? "fist" : "thrust"]) {
                    keys.add(prefix + variant + "-" + action);
                }
                if (weapon !== WeaponId.Fist) {
                    keys.add(prefix + variant + "-throw");
                    keys.add(prefix + variant + "-equip");
                    if (fighter.skills.some((skill) => SKILLS[skill.id].downWeapon)) {
                        keys.add(prefix + variant + "-put-down");
                        keys.add(prefix + variant + "-pick-up");
                    }
                } else if (fighter.weapons.length) {
                    // 投掷脱手后，同一时间轴切到空手收招。
                    keys.add(prefix + variant + "-throw");
                }
                for (const skill of fighter.skills) {
                    if (weapon !== WeaponId.Fist && SKILLS[skill.id].downWeapon) continue;
                    keys.add(prefix + (weapon === WeaponId.Fist ? "" : variant + "-") + SKILLS[skill.id].clip);
                }
            }
        }
        return keys;
    }

    /** 按参战者性别缓存头像，不修改场景头像坐标。 */
    private async preparePortraits(info: BattleInfo, onLoaded: () => void) {
        for (const gender of new Set(info.fighters.map((fighter) => fighter.gender))) {
            if (this.portraits.has(gender)) { onLoaded(); continue; }
            const name = gender === FighterGender.Male ? "male" : "female";
            const frame = await this.view.serve.assetService.load(ASSET_ROOT + "ui/portrait-" + name + "/spriteFrame", SpriteFrame);
            frame.addRef();
            this.portraits.set(gender, frame);
            onLoaded();
        }
    }

    /** 转发逻辑帧事件。 */
    onFrame(world: BattleWorld) { this.presentation?.onFrame(world); }

    /** 更新玩法表现，不修改场景布局和画布尺寸。 */
    protected override onUpdate(dt: number) {
        const session = this.view.context.session;
        if (!session || !this.presentation || this.view.context.loading) return;
        const speed = session.paused ? 0 : session.speed;
        this.presentation.render(session.world, session.alpha, dt * speed, speed);
    }

    /** 清理上一局的播放时间与伤害提示。 */
    reset() { this.presentation?.reset(); }

    /** 清理本场表现状态，动作图集和头像保持缓存。 */
    protected override onUnload() {
        this.presentation?.dispose();
        this.presentation = undefined;
        this.frames.clear();
    }
}
