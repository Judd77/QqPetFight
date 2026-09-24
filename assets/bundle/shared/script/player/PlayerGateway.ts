import { sys } from "cc";
import type { FighterInfo } from "db://assets/bundle/ingame/gameplay/script/model/GameplayTypes";

/** 玩家接口响应；主角配装由玩家数据提供，与关卡表独立。 */
export interface PlayerProfile {
    version: 1;
    fighter: FighterInfo;
}
export interface PlayerGateway {
    getProfile(): Promise<PlayerProfile>;
}

/** 当前离线版本的玩家存档适配器，联网时只替换此接口实现。 */
class LocalPlayerGateway implements PlayerGateway {
    async getProfile(): Promise<PlayerProfile> {
        const key = "qpet.player.v1";
        const raw = sys.localStorage.getItem(key);
        let profile: PlayerProfile;
        if (raw) {
            profile = JSON.parse(raw) as PlayerProfile;
            if (profile.version !== 1 || !profile.fighter) throw new Error("玩家存档格式不支持");
        } else {
            profile = {
                version: 1,
                fighter: {
                    id: 0, name: "少侠", gender: 0, hp: 650, maxHp: 650,
                    weapons: [], skills: [],
                },
            };
        }
        profile.fighter.weapons = Array.from(new Set(profile.fighter.weapons.concat([1, 2, 3, 4, 5, 6])));
        const skills = new Map(profile.fighter.skills.map((skill) => [skill.id, skill]));
        for (const skill of [
            { id: 15, power: 68 }, { id: 22, power: 140 }, { id: 25, power: 100 },
            { id: 27, power: 110 }, { id: 28, power: 56 }, { id: 31, power: 82 },
        ]) {
            if (!skills.has(skill.id)) skills.set(skill.id, skill);
        }
        profile.fighter.skills = Array.from(skills.values());
        sys.localStorage.setItem(key, JSON.stringify(profile));
        return profile;
    }
}
export const playerGateway: PlayerGateway = new LocalPlayerGateway();
