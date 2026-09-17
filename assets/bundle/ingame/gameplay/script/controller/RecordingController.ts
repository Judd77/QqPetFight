import { sys } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleRecording } from "../battle/BattleTypes";
import { validateRecording } from "../battle/BattleSession";

interface SavedBattle {
    id: string;
    savedAt: number;
    checksum: string;
    recording: BattleRecording;
}

const STORAGE_KEY = "qpet.demo.recordings.v2";
const MAX_RECORDINGS = 20;

/** 单机录像收藏；使用独立存储键，不改动账号数据和其他存档。 */
export class RecordingController extends BaseController<GameplayView> {
    private records: SavedBattle[] = [];
    private storageError?: unknown;

    /** 读取已有收藏；存储损坏不阻断战斗，也不覆盖原始存档。 */
    protected override onLoad() {
        try { this.records = this.readRecords(); }
        catch (error) {
            this.storageError = error;
            console.warn("无法读取本机录像收藏", error);
        }
    }

    /** 当前完整战斗是否已经收藏。 */
    get isCurrentSaved() {
        const context = this.view.context;
        return this.records.some((item) => item.id === context.lastRecording?.battle.id && item.checksum === context.lastChecksum);
    }

    /** 收藏完整初始数据、服务帧和最终校验值；重复点击不新增副本。 */
    save() {
        if (this.storageError) throw this.storageError;
        const context = this.view.context;
        if (!context.session?.finished || !context.completed || !context.lastRecording) throw new Error("战斗尚未结束");
        validateRecording(context.lastRecording);
        const records = this.readRecords();
        if (records.some((item) => item.id === context.lastRecording!.battle.id && item.checksum === context.lastChecksum)) {
            this.records = records;
            return;
        }
        if (records.length >= MAX_RECORDINGS) throw new Error("本机录像收藏已满");
        const entry: SavedBattle = {
            id: context.lastRecording.battle.id, savedAt: Date.now(),
            checksum: context.lastChecksum, recording: context.lastRecording,
        };
        const serialized = JSON.stringify([...records, entry]);
        sys.localStorage.setItem(STORAGE_KEY, serialized);
        this.records = JSON.parse(serialized) as SavedBattle[];
    }

    /** 返回收藏摘要，不把内部录像对象暴露给列表界面。 */
    list() {
        return this.records.map(({ id, savedAt, checksum, recording }) => ({
            id, savedAt, checksum, names: recording.battle.fighters.map((fighter) => fighter.name),
        }));
    }

    /** 用保存的种子、配装与服务帧重播，结束后校验结果。 */
    async replay(id: string, checksum: string) {
        const saved = this.records.find((item) => item.id === id && item.checksum === checksum);
        if (!saved) throw new Error("找不到收藏录像");
        await this.view.replay(saved.recording, saved.checksum);
    }

    /** 校验存储格式，不静默丢弃损坏条目。 */
    private readRecords(): SavedBattle[] {
        const raw = sys.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const records = JSON.parse(raw) as SavedBattle[];
        if (!Array.isArray(records) || records.length > MAX_RECORDINGS) throw new Error("录像收藏格式无效");
        for (const entry of records) {
            if (!entry || !Number.isSafeInteger(entry.savedAt) || !/^[0-9a-f]{8}$/.test(entry.checksum)) {
                throw new Error("录像收藏信息无效");
            }
            validateRecording(entry.recording);
            if (entry.id !== entry.recording.battle.id) throw new Error("录像收藏编号不一致");
        }
        return records;
    }
}
