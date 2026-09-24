import { playerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import { FighterGender, FighterInfo } from "../../gameplay/script/common/GameplayTypes";
import { GameplayEntry, GameplayMode } from "../../gameplay/script/common/GameplayEntry";

export interface PvpGateway {
    match(): Promise<GameplayEntry>;
}

/** 离线匹配响应；当前固定为 mm，正式联网时替换此接口实现。 */
class LocalPvpGateway implements PvpGateway {
    async match(): Promise<GameplayEntry> {
        const { fighter } = await playerGateway.getProfile();
        const opponent: FighterInfo = {
            id: 1, name: "女侠", gender: FighterGender.Female, hp: 650, maxHp: 650,
            weapons: [1, 2, 3],
            skills: [{ id: 22, power: 140 }, { id: 25, power: 100 }, { id: 27, power: 110 }],
        };
        const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
        return {
            mode: GameplayMode.Pvp,
            battle: {
                id: "pvp-" + Date.now() + "-" + seed,
                seed,
                fighters: [
                    { ...fighter, id: 0, hp: fighter.maxHp, weapons: fighter.weapons.slice(),
                        skills: fighter.skills.map(skill => ({ ...skill })) },
                    opponent,
                ],
            },
        };
    }
}

export const pvpGateway: PvpGateway = new LocalPvpGateway();
