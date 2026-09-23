import type { BattleFrameSource } from "./BattleFrameSource";
import type { BattleRecording, ServiceFrame } from "./BattleTypes";

/** 按录像中的原始顺序提供服务帧，不重新生成任何战斗指令。 */
export class ReplayFrameSource implements BattleFrameSource {
    private nextFrameIndex = 0;

    constructor(private readonly recording: BattleRecording) {}

    /** 返回下一录像帧；录像全部读完后返回 undefined。 */
    readNextFrame(_canStartAction: boolean): ServiceFrame | undefined {
        return this.recording.frames[this.nextFrameIndex++];
    }
}
