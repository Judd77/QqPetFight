import { Asset, Constructor, SpriteAtlas, SpriteFrame } from "cc";
import type { GameplayConfig } from "../model/GameplayConfig";
import { FighterGender, FighterInfo } from "../model/GameplayTypes";

/** 根据本场角色数据生成资源清单，不整批加载其他角色。 */
export function getFighterAssets(config: GameplayConfig, fighters: readonly FighterInfo[]) {
    const assets = new Map<string, Constructor<Asset>>();
    for (const animation of config.getRequiredAnimations({ fighters })) {
        assets.set(animation.assetPath, SpriteAtlas);
    }
    for (const fighter of fighters) {
        assets.set(getPortraitPath(config, fighter), SpriteFrame);
        for (const id of fighter.weapons) {
            const path = config.getWeapon(id).iconPath;
            if (path) assets.set(path, SpriteFrame);
        }
        for (const skill of fighter.skills) {
            assets.set(config.getSkill(skill.id).iconPath, SpriteFrame);
        }
    }
    return Array.from(assets, ([path, type]) => ({ path, type }));
}

export function getPortraitPath(config: GameplayConfig, fighter: FighterInfo) {
    return fighter.portraitPath || (fighter.gender === FighterGender.Male
        ? config.view.malePortrait : config.view.femalePortrait);
}
