import { Prefab, SpriteAtlas, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { AssetStore } from "db://assets/bundle/shared/script/asset/AssetStore";
import type { GameplayView } from "../GameplayView";
import { BattleInfo, FighterInfo, SkillId, WeaponId } from "../model/GameplayTypes";
import { getFighterAssets, getPortraitPath } from "./GameplayAssets";

/** Gameplay 资源入口：按本场数据补齐资源，表现业务只按路径取缓存。 */
export class AssetController extends BaseController<GameplayView> {
    private get assets() { return this.view.serve.getService(AssetStore); }

    protected override async onLoad() {
        const { view } = this.view.config;
        await Promise.all([
            this.assets.load(this.view.serve.assetService, view.weaponCellPrefab, Prefab),
            this.assets.load(this.view.serve.assetService, view.skillCellPrefab, Prefab),
        ]);
    }

    async prepare(info: BattleInfo, onProgress?: (progress: number) => void) {
        const entries = getFighterAssets(this.view.config, info.fighters);
        let completed = 0;
        onProgress?.(entries.length ? 0 : 1);
        const results = await Promise.allSettled(entries.map(async ({ path, type }) => {
            await this.assets.load(this.view.serve.assetService, path, type);
            onProgress?.(++completed / entries.length);
        }));
        const failed = results.find(result => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
    }

    getRoleAtlas(clipId: string) {
        return this.assets.get<SpriteAtlas>(this.view.config.getAnimationPath(clipId));
    }

    getWeaponFrame(id: WeaponId) {
        return this.assets.get<SpriteFrame>(this.view.config.getWeapon(id).iconPath);
    }

    getSkillFrame(id: SkillId) {
        return this.assets.get<SpriteFrame>(this.view.config.getSkill(id).iconPath);
    }

    getPortrait(fighter: FighterInfo) {
        return this.assets.get<SpriteFrame>(getPortraitPath(this.view.config, fighter));
    }

    get weaponCellPrefab() {
        return this.assets.get<Prefab>(this.view.config.view.weaponCellPrefab);
    }

    get skillCellPrefab() {
        return this.assets.get<Prefab>(this.view.config.view.skillCellPrefab);
    }
}
