import { sys } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleRecording } from "../model/GameplayTypes";
import { validateBattleRecording } from "./RecordingValidator";

interface SavedBattle {
    id: string;
    savedAt: number;
    checksum: string;
    recording: BattleRecording;
}

/** 单机录像收藏；容量与存储键由配置表提供。 */
export class RecordingController extends BaseController<GameplayView> {
    private records: SavedBattle[] = [];
    private storageError?: unknown;

    protected override onLoad() {
        try {
            this.records = this.readRecords();
        } catch (error) {
            this.storageError = error;
            console.warn("无法读取本机录像收藏", error);
        }
    }

    get isCurrentSaved() {
        const context = this.view.context;
        return this.records.some((item) =>
            item.id === context.lastRecording?.battle.id && item.checksum === context.lastChecksum);
    }

    /** 校验外部录像能否交给当前配置的锁步系统执行。 */
    validate(recording: BattleRecording) {
        validateBattleRecording(recording, this.view.config.battle);
    }

    save() {
        if (this.storageError) throw this.storageError;
        const context = this.view.context;
        if (!context.lockstep?.finished || !context.completed || !context.lastRecording) {
            throw new Error("战斗尚未结束");
        }
        validateBattleRecording(context.lastRecording, this.view.config.battle);
        const records = this.readRecords();
        if (records.some((item) =>
            item.id === context.lastRecording!.battle.id && item.checksum === context.lastChecksum)) {
            this.records = records;
            return;
        }
        if (records.length >= this.view.config.view.maxRecordings) throw new Error("本机录像收藏已满");
        const entry: SavedBattle = {
            id: context.lastRecording.battle.id,
            savedAt: Date.now(),
            checksum: context.lastChecksum,
            recording: context.lastRecording,
        };
        const serialized = JSON.stringify(records.concat(entry));
        sys.localStorage.setItem(this.view.config.view.recordingStorageKey, serialized);
        this.records = JSON.parse(serialized) as SavedBattle[];
    }

    list() {
        return this.records.map(({ id, savedAt, checksum, recording }) => ({
            id,
            savedAt,
            checksum,
            names: recording.battle.fighters.map((fighter) => fighter.name),
        }));
    }

    async replay(id: string, checksum: string) {
        const saved = this.records.find((item) => item.id === id && item.checksum === checksum);
        if (!saved) throw new Error("找不到收藏录像");
        await this.view.replay(saved.recording, saved.checksum);
    }

    private readRecords(): SavedBattle[] {
        const raw = sys.localStorage.getItem(this.view.config.view.recordingStorageKey);
        if (!raw) return [];
        const records = JSON.parse(raw) as SavedBattle[];
        if (!Array.isArray(records) || records.length > this.view.config.view.maxRecordings) {
            throw new Error("录像收藏格式无效");
        }
        for (const entry of records) {
            if (!entry || !Number.isSafeInteger(entry.savedAt) || !/^[0-9a-f]{8}$/.test(entry.checksum)) {
                throw new Error("录像收藏信息无效");
            }
            validateBattleRecording(entry.recording, this.view.config.battle);
            if (entry.id !== entry.recording.battle.id) throw new Error("录像收藏编号不一致");
        }
        return records;
    }
}
