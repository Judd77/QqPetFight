import type { BattleRecording, ServiceFrame } from "../common/GameplayTypes";
import type { FrameSource } from "./FrameSource";

/** 回放服务帧来源：按录像原始顺序读取，不重新生成战斗指令。 */
export class ReplayFrameSource implements FrameSource {
    private nextFrameIndex = 0;

    constructor(private readonly recording: BattleRecording) {}

    /** 返回下一录像帧；录像全部读完后返回 undefined。 */
    readNextFrame(_canStartAction: boolean): ServiceFrame | undefined {
        return this.recording.frames[this.nextFrameIndex++];
    }
}
