import { Prefab, SpriteAtlas, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { RoleAnimation } from "../model/GameplayConfig";
import type { GameplayView } from "../GameplayView";
import { BattleInfo, FighterGender, FighterInfo, SkillId, WeaponId } from "../model/GameplayTypes";

const roleAtlases = new Map<string, SpriteAtlas>();
const weaponFrames = new Map<WeaponId, SpriteFrame>();
const skillFrames = new Map<SkillId, SpriteFrame>();
const frames = new Map<string, SpriteFrame>();
let weaponCellPrefab: Prefab | undefined;
let skillCellPrefab: Prefab | undefined;

/** Gameplay 资源服务：集中加载并长期缓存本局动态资源。 */
export class AssetController extends BaseController<GameplayView> {
    protected override async onLoad() {
        const config = this.view.config.view;
        if (!weaponCellPrefab) {
            weaponCellPrefab = await this.view.serve.assetService.load(config.weaponCellPrefab, Prefab);
            weaponCellPrefab.addRef();
        }
        if (!skillCellPrefab) {
            skillCellPrefab = await this.view.serve.assetService.load(config.skillCellPrefab, Prefab);
            skillCellPrefab.addRef();
        }
    }

    async prepare(info: BattleInfo, onProgress?: (progress: number) => void) {
        const animations = this.view.config.getRequiredAnimations(info);
        const weapons = Array.from(new Set(info.fighters.flatMap((fighter) => fighter.weapons)));
        const skills = Array.from(new Set(info.fighters.flatMap((fighter) => fighter.skills.map((skill) => skill.id))));
        const tasks: Array<() => Promise<void>> = [];

        for (const animation of animations) tasks.push(() => this.loadAnimation(animation));
        for (const fighter of info.fighters) {
            tasks.push(() => this.loadFrame(this.getPortraitPath(fighter)));
        }
        for (const weapon of weapons) tasks.push(() => this.loadWeapon(weapon));
        for (const skill of skills) tasks.push(() => this.loadSkill(skill));

        let completed = 0;
        onProgress?.(tasks.length ? 0 : 1);
        const results = await Promise.allSettled(tasks.map(async (task) => {
            await task();
            onProgress?.(++completed / tasks.length);
        }));
        const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
    }

    getRoleAtlas(clipId: string) {
        const value = roleAtlases.get(clipId);
        if (!value) throw new Error("角色图集尚未加载：" + clipId);
        return value;
    }

    getWeaponFrame(id: WeaponId) {
        const value = weaponFrames.get(id);
        if (!value) throw new Error("武器图片尚未加载：" + id);
        return value;
    }

    getSkillFrame(id: SkillId) {
        const value = skillFrames.get(id);
        if (!value) throw new Error("技能图片尚未加载：" + id);
        return value;
    }

    getPortrait(fighter: FighterInfo) {
        const path = this.getPortraitPath(fighter);
        const value = frames.get(path);
        if (!value) throw new Error("头像尚未加载：" + path);
        return value;
    }

    get weaponCellPrefab() {
        if (!weaponCellPrefab) throw new Error("武器格预制体尚未加载");
        return weaponCellPrefab;
    }

    get skillCellPrefab() {
        if (!skillCellPrefab) throw new Error("技能格预制体尚未加载");
        return skillCellPrefab;
    }

    private async loadAnimation(animation: RoleAnimation) {
        if (roleAtlases.has(animation.id)) return;
        const atlas = await this.view.serve.assetService.load(animation.assetPath, SpriteAtlas);
        atlas.addRef();
        roleAtlases.set(animation.id, atlas);
    }

    private async loadWeapon(id: WeaponId) {
        if (weaponFrames.has(id)) return;
        const path = this.view.config.getWeapon(id).iconPath;
        if (!path) return;
        const frame = await this.view.serve.assetService.load(path, SpriteFrame);
        frame.addRef();
        weaponFrames.set(id, frame);
    }

    private async loadSkill(id: SkillId) {
        if (skillFrames.has(id)) return;
        const frame = await this.view.serve.assetService.load(this.view.config.getSkill(id).iconPath, SpriteFrame);
        frame.addRef();
        skillFrames.set(id, frame);
    }

    private async loadFrame(path: string) {
        if (frames.has(path)) return;
        const frame = await this.view.serve.assetService.load(path, SpriteFrame);
        frame.addRef();
        frames.set(path, frame);
    }

    private getPortraitPath(fighter: FighterInfo) {
        return fighter.portraitPath || (fighter.gender === FighterGender.Male
            ? this.view.config.view.malePortrait
            : this.view.config.view.femalePortrait);
    }
}
