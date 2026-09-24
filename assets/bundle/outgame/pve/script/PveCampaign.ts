import type { Schema } from "db://assets/bundle/shared/script/schema/Schema";
import { playerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import { GameplayEntry, GameplayMode } from "../../../ingame/gameplay/script/model/GameplayEntry";

let clearedStages = 0;

/** 关卡编排和本次运行进度；关闭或刷新游戏后从第一关重新开始。 */
export class PveCampaign {
    getStages(tables: Schema.Tables) {
        return tables.TbPveStage.getDataList().slice().sort((a, b) => a.id - b.id);
    }

    getCleared() {
        return clearedStages;
    }

    getCurrent(tables: Schema.Tables) {
        const stages = this.getStages(tables);
        if (!stages.length) throw new Error("缺少 PVE 关卡配置");
        return stages[Math.min(this.getCleared(), stages.length - 1)]!;
    }

    async createBattle(stageId: number, tables: Schema.Tables): Promise<GameplayEntry> {
        const stages = this.getStages(tables);
        const index = stages.findIndex(stage => stage.id === stageId);
        if (index < 0 || index > this.getCleared()) throw new Error("关卡尚未解锁");
        const stage = stages[index]!;
        const profile = await playerGateway.getProfile();
        const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
        const player = profile.fighter;
        return {
            mode: GameplayMode.Pve,
            stageId,
            battle: {
                id: "pve-" + stageId + "-" + Date.now() + "-" + seed,
                seed,
                fighters: [
                    { ...player, id: 0, hp: player.maxHp, weapons: player.weapons.slice(),
                        skills: player.skills.map(skill => ({ ...skill })) },
                    {
                        id: 1, name: stage.name, gender: stage.gender, hp: stage.hp, maxHp: stage.hp,
                        weapons: stage.weapons.slice(),
                        portraitPath: stage.portrait,
                        npcId: stage.npcId,
                        skills: stage.skills.map(id => {
                            const skill = tables.TbSkill.get(id);
                            if (!skill) throw new Error("关卡引用未知技能：" + id);
                            return { id, power: skill.power };
                        }),
                    },
                ],
            },
        };
    }

    complete(stageId: number, winner: number, tables: Schema.Tables) {
        if (winner !== 0) return;
        const stages = this.getStages(tables);
        const index = stages.findIndex(stage => stage.id === stageId);
        const cleared = this.getCleared();
        if (index < 0 || index > cleared) throw new Error("无法结算未解锁关卡");
        if (index < cleared) return;
        clearedStages = cleared + 1;
    }
}
