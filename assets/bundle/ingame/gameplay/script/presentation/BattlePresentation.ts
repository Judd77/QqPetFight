import { Color, Label, Node, Sprite, SpriteAtlas, SpriteFrame } from "cc";
import { BattleEventType, BattlePhase, FighterAction, FighterGender, FRAME_RATE, SKILLS, WeaponId, WEAPONS } from "../battle/BattleTypes";
import type { BattleWorld } from "../battle/BattleWorld";

import type { RoleAnimationEntry, RoleFrameEntry, TbRoleAnimation } from "db://assets/bundle/shared/script/schema/Schema";

/** 播放官网原始时间轴导出的图集，保持每帧的原点和武器手部变换。 */
export class BattlePresentation {
    declare root: Node;
    private readonly sprites: Sprite[] = [];
    private readonly actors: Node[] = [];
    private readonly damageLabels: Label[] = [];
    private readonly damageTime = [0, 0];
    private readonly clips = new Map<string, { atlas: SpriteAtlas; frames: SpriteFrame[]; data: readonly RoleFrameEntry[]; config: RoleAnimationEntry }>();
    private readonly lastFrames = ["", ""];
    private weaponFrames: ReadonlyMap<WeaponId, SpriteFrame> = new Map();
    declare private projectile: Sprite;
    private readonly groundWeapons: Sprite[] = [];
    private finishElapsed = 0;

    /** 使用已保存的战场节点，绑定已导入的图集帧资源。 */
    init(parent: Node, animations: TbRoleAnimation, frameTable: ReadonlyMap<string, readonly RoleFrameEntry[]>, atlases: Map<string, SpriteAtlas>, weapons: Map<WeaponId, SpriteFrame>) {
        this.root = parent;
        for (const name of ["Left", "Right"]) {
            const actor = this.root.getChildByPath("Fighters/" + name)!;
            this.actors.push(actor);
            this.groundWeapons.push(this.root.getChildByPath("Fighters/GroundWeapon" + this.actors.length)!.getComponent(Sprite)!);
            const sprite = actor.getChildByName("Actor")!.getComponent(Sprite)!;
            sprite.sizeMode = Sprite.SizeMode.RAW;
            this.sprites.push(sprite);
        }
        for (let i = 0; i < 2; i++) this.damageLabels.push(this.root.getChildByPath("Fighters/Damage" + i)!.getComponent(Label)!);
        this.projectile = this.root.getChildByPath("Fighters/Projectile")!.getComponent(Sprite)!;
        this.weaponFrames = weapons;
        for (const [key, atlas] of atlases) {
            const config = animations.get(key);
            const data = frameTable.get(key);
            if (!config || !data?.length || config.fps <= 0) throw new Error("缺少角色动作配置：" + key);
            for (let index = 0; index < data.length; index++) {
                if (!data[index]) throw new Error("角色帧不连续：" + key + ":" + index);
            }
            const frames = data.map((row) => {
                const name = key + "_" + String(row.index).padStart(4, "0");
                const frame = atlas.getSpriteFrame(name);
                if (!frame) throw new Error("缺少角色帧资源：" + name);
                return frame;
            });
            this.clips.set(key, { atlas, frames, data, config });
        }
    }

    /** 同一帧的受击信息交给固定伤害节点展示。 */
    onFrame(world: BattleWorld) {
        for (const event of world.events) {
            if (event.target === undefined || ![BattleEventType.Hit, BattleEventType.Dodge, BattleEventType.Block, BattleEventType.Heal].includes(event.type)) continue;
            const label = this.damageLabels[event.target]!;
            label.string = event.type === BattleEventType.Heal ? "+" + event.damage : event.type === BattleEventType.Dodge ? "闪避" : event.damage ? "-" + event.damage : "格挡";
            label.color = event.type === BattleEventType.Heal ? new Color(100, 255, 120) : event.critical ? new Color(255, 95, 30) : new Color(255, 232, 92);
            const target = world.fighters[event.target]!;
            label.node.setPosition(target.x, -110);
            label.node.active = true;
            this.damageTime[event.target] = 0.75;
        }
    }

    /** 坐标插值与序列帧播放，不参与伤害计算。 */
    render(world: BattleWorld, alpha: number, dt: number, speed: number) {
        this.updateActorOrder(world.activePlayer);
        if (world.phase === BattlePhase.Finished) this.finishElapsed += dt;
        for (const fighter of world.fighters) {
            const ground = this.groundWeapons[fighter.id]!;
            ground.node.active = fighter.stowedWeapon !== WeaponId.Fist;
            if (ground.node.active) {
                ground.spriteFrame = this.weaponFrames.get(fighter.stowedWeapon)!;
                const size = ground.spriteFrame.originalSize;
                const scale = Math.min(75 / size.width, 55 / size.height);
                ground.node.setScale(scale, scale, 1);
                ground.node.setPosition(fighter.x + fighter.facing * 50, -220);
                ground.node.angle = fighter.facing * -25;
            }
            const actor = this.actors[fighter.id]!;
            actor.setPosition(fighter.previousX + (fighter.x - fighter.previousX) * alpha, -202);
            actor.setScale(fighter.action === FighterAction.Retreat ? -fighter.facing : fighter.facing, 1, 1);
            const variant = WEAPONS[fighter.weapon].role;
            const animation = this.animationName(fighter.action, fighter.weapon);
            const prefix = world.info.fighters[fighter.id]!.gender === FighterGender.Male ? "male-" : "";
            const key = fighter.action === FighterAction.Skill ? prefix + (fighter.weapon === WeaponId.Fist ? "" : variant + "-") + SKILLS[fighter.skill].clip : prefix + variant + "-" + animation;
            const clip = this.clips.get(key);
            if (!clip) throw new Error("缺少角色动作：" + key);
            const elapsed = Math.max(0, (world.tick - 1 + alpha - fighter.actionFrame) / FRAME_RATE) + this.finishElapsed;
            const loop = fighter.action === FighterAction.Idle || fighter.action === FighterAction.Run || fighter.action === FighterAction.Retreat;
            const index = loop ? Math.floor(elapsed * clip.config.fps) % clip.frames.length : Math.min(clip.frames.length - 1, Math.floor(elapsed * clip.config.fps));
            const frameKey = key + ":" + index;
            if (this.lastFrames[fighter.id] !== frameKey) {
                const sprite = this.sprites[fighter.id]!;
                const rect = clip.data[index]!;
                sprite.spriteAtlas = clip.atlas;
                sprite.spriteFrame = clip.frames[index]!;
                sprite.node.setScale(rect.scale, rect.scale, 1);
                // 脚底与翻转轴偏移读取 Luban 动画表，原始帧位移保持不变。
                sprite.node.setPosition(rect.dx + clip.config.offsetX, rect.dy + clip.config.offsetY);
                this.lastFrames[fighter.id] = frameKey;
            }
        }
        const projectile = world.projectiles[0];
        this.projectile.node.active = !!projectile;
        if (projectile) {
            const t = Math.max(0, Math.min(1, (world.tick - projectile.startFrame + alpha) / (projectile.endFrame - projectile.startFrame)));
            this.projectile.spriteFrame = this.weaponFrames.get(projectile.weapon)!;
            this.projectile.sizeMode = Sprite.SizeMode.RAW;
            const size = this.projectile.spriteFrame.originalSize;
            const scale = Math.min(105 / size.width, 85 / size.height);
            this.projectile.node.setScale(scale, scale, 1);
            const straight = WEAPONS[projectile.weapon].isRanged;
            this.projectile.node.setPosition(projectile.startX + (projectile.endX - projectile.startX) * t, -170 + (straight ? 0 : Math.sin(t * Math.PI) * 85));
            this.projectile.node.angle = straight ? (projectile.endX >= projectile.startX ? 0 : 180) : -t * 720;
        }
        for (let i = 0; i < 2; i++) {
            if (this.damageTime[i]! <= 0) continue;
            this.damageTime[i] = Math.max(0, this.damageTime[i]! - dt);
            const node = this.damageLabels[i]!.node;
            node.setPosition(node.position.x, node.position.y + dt * 55);
            node.active = this.damageTime[i]! > 0;
        }
    }

    /** 攻击方压在受击方前面，只交换角色顺序，不遮挡伤害数字和飞行武器。 */
    private updateActorOrder(activePlayer: number) {
        const attacker = this.actors[activePlayer]!;
        const defender = this.actors[1 - activePlayer]!;
        const attackerIndex = attacker.getSiblingIndex();
        const defenderIndex = defender.getSiblingIndex();
        if (attackerIndex > defenderIndex) return;
        attacker.setSiblingIndex(defenderIndex);
        defender.setSiblingIndex(attackerIndex);
    }

    /** 将战斗动作映射到原版动画片段。 */
    private animationName(action: FighterAction, weapon: WeaponId): string {
        switch (action) {
            case FighterAction.Run:
            case FighterAction.Retreat:
                return "run";
            case FighterAction.Attack:
                return weapon === WeaponId.Fist ? "fist" : "thrust";
            case FighterAction.Throw:
                return "throw";
            case FighterAction.Equip:
                return "equip";
            case FighterAction.PutDown:
                return "put-down";
            case FighterAction.PickUp:
                return "pick-up";
            case FighterAction.Hurt:
                return "hurt";
            case FighterAction.Dodge:
                return "dodge";
            case FighterAction.Victory:
                return "win";
            case FighterAction.Dead:
                return "lose";
            default:
                return "idle";
        }
    }

    /** 重播时归零表现状态，保留场景结构。 */
    reset() {
        this.finishElapsed = 0;
        this.lastFrames.fill("");
        this.damageTime.fill(0);
        for (const label of this.damageLabels) label.node.active = false;
        if (this.projectile) this.projectile.node.active = false;
        for (const ground of this.groundWeapons) ground.node.active = false;
    }

    /** 清理节点上的图集引用；资源引用计数由加载它的 Controller 管理。 */
    dispose() {
        for (const sprite of this.sprites) {
            sprite.spriteFrame = null;
            sprite.spriteAtlas = null;
        }
        this.clips.clear();
        this.reset();
    }
}
