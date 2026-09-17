import { AudioClip, AudioSource, Node, sys } from "cc";
import { AssetService } from "./AssetService";

const MUSIC_VOLUME_KEY = "Framework.MusicVolume";
const SOUND_VOLUME_KEY = "Framework.SoundVolume";

/** 按业务目录加载音频，统一缓存后由业务按名称播放。 */
export class AudioService {
    private readonly clips = new Map<string, AudioClip>();
    private readonly loadedAudioPaths = new Set<string>();
    private readonly loadingAudioPaths = new Map<string, Promise<void>>();
    private readonly musicSource: AudioSource;
    private readonly soundSource: AudioSource;
    private musicVolume: number;
    private soundVolume: number;

    /** 初始化持久音源，并保留用户已保存的音量设置。 */
    constructor(
        private readonly assets: AssetService,
        node: Node,
    ) {
        this.musicSource = node.addComponent(AudioSource);
        this.soundSource = node.addComponent(AudioSource);
        this.musicSource.playOnAwake = false;
        this.soundSource.playOnAwake = false;
        this.musicVolume = this.readVolume(MUSIC_VOLUME_KEY);
        this.soundVolume = this.readVolume(SOUND_VOLUME_KEY);
    }

    /** 加载业务目录下的 audio；重复或并发进入同一业务不会重复加载。 */
    async setAudioClips(businessPath: string) {
        if (this.loadedAudioPaths.has(businessPath)) return;
        const loading = this.loadingAudioPaths.get(businessPath);
        if (loading) return loading;

        const task = this.loadAudioClips(businessPath);
        this.loadingAudioPaths.set(businessPath, task);
        try {
            await task;
        } finally {
            if (this.loadingAudioPaths.get(businessPath) === task) this.loadingAudioPaths.delete(businessPath);
        }
    }

    /** 按名称播放一次音效。 */
    playSound(name: string) {
        const clip = this.clips.get(name);
        if (clip) this.soundSource.playOneShot(clip, this.soundVolume);
    }

    /** 切换背景音乐，同一首正在播放的音乐不重复启动。 */
    playMusic(name: string, loop = true): boolean {
        const clip = this.clips.get(name);
        if (!clip) return false;
        if (this.musicSource.playing && this.musicSource.clip === clip) return false;

        this.musicSource.stop();
        this.musicSource.clip = clip;
        this.musicSource.loop = loop;
        this.musicSource.volume = this.musicVolume;
        this.musicSource.play();
        return true;
    }

    /** 停止背景音乐，保留已加载资源供后续复用。 */
    stopMusic() {
        this.musicSource.stop();
    }

    /** 保存音乐音量并立即更新当前音源。 */
    setMusicVolume(volume: number) {
        this.musicVolume = this.normalizeVolume(volume);
        sys.localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
        this.musicSource.volume = this.musicVolume;
    }

    /** 保存音效音量，不修改音乐音量。 */
    setSoundVolume(volume: number) {
        this.soundVolume = this.normalizeVolume(volume);
        sys.localStorage.setItem(SOUND_VOLUME_KEY, String(this.soundVolume));
        this.soundSource.volume = this.soundVolume;
    }

    /** 完整检查重名后才加入缓存，失败的目录允许重试。 */
    private async loadAudioClips(businessPath: string) {
        const clips = await this.assets.loadAudioClips(businessPath);
        const newClips = new Map<string, AudioClip>();
        for (const clip of clips) {
            if (newClips.has(clip.name) || this.clips.has(clip.name)) {
                throw new Error(`音频名称重复【${clip.name}】，来源目录【${businessPath}/audio】`);
            }
            newClips.set(clip.name, clip);
        }
        for (const [name, clip] of newClips) this.clips.set(name, clip);
        this.loadedAudioPaths.add(businessPath);
    }

    /** 未保存或无效时使用默认音量；显式保存的 0 仍保持静音。 */
    private readVolume(key: string): number {
        const stored = sys.localStorage.getItem(key);
        if (stored === null || stored.trim() === "") return 1;
        const value = Number(stored);
        return Number.isFinite(value) ? this.normalizeVolume(value) : 1;
    }

    /** 音量限制在 0～1，无效数值回退默认音量。 */
    private normalizeVolume(volume: number): number {
        return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    }
}
