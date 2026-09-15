import { AudioClip, AudioSource, Node, sys } from "cc";
import { AssetService } from "./AssetService";

const MUSIC_VOLUME_KEY = "Framework.MusicVolume";
const SOUND_VOLUME_KEY = "Framework.SoundVolume";

/** 支持按业务分组加载音频，但不预设任何音频名称。 */
export class AudioService {
    private readonly groups = new Map<string, Map<string, AudioClip>>();
    private readonly loadingGroups = new Map<string, Promise<void>>();
    private musicSource?: AudioSource;
    private soundSource?: AudioSource;
    private musicVolume = 1;
    private soundVolume = 1;

    constructor(
        private readonly assets: AssetService,
        node: Node,
    ) {
        this.musicSource = node.addComponent(AudioSource);
        this.soundSource = node.addComponent(AudioSource);
        this.musicVolume = this.readVolume(MUSIC_VOLUME_KEY);
        this.soundVolume = this.readVolume(SOUND_VOLUME_KEY);
    }

    async loadGroup(group: string, path: string) {
        if (this.groups.has(group)) return;
        const loading = this.loadingGroups.get(group);
        if (loading) return loading;

        const task = this.loadAudioGroup(group, path);
        this.loadingGroups.set(group, task);
        try {
            await task;
        } finally {
            if (this.loadingGroups.get(group) === task) this.loadingGroups.delete(group);
        }
    }

    playSound(name: string, group = "default") {
        const clip = this.getClip(group, name);
        if (clip && this.soundSource) this.soundSource.playOneShot(clip, this.soundVolume);
    }

    playMusic(name: string, group = "default", loop = true): boolean {
        const clip = this.getClip(group, name);
        if (!clip || !this.musicSource) return false;
        if (this.musicSource.playing && this.musicSource.clip === clip) return false;

        this.musicSource.stop();
        this.musicSource.clip = clip;
        this.musicSource.loop = loop;
        this.musicSource.volume = this.musicVolume;
        this.musicSource.play();
        return true;
    }

    stopMusic() {
        this.musicSource?.stop();
    }

    setMusicVolume(volume: number) {
        this.musicVolume = this.normalizeVolume(volume);
        sys.localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
        if (this.musicSource) this.musicSource.volume = this.musicVolume;
    }

    setSoundVolume(volume: number) {
        this.soundVolume = this.normalizeVolume(volume);
        sys.localStorage.setItem(SOUND_VOLUME_KEY, String(this.soundVolume));
        if (this.soundSource) this.soundSource.volume = this.soundVolume;
    }

    unloadGroup(group: string) {
        const clips = this.groups.get(group);
        if (!clips) return;
        for (const clip of clips.values()) this.assets.release(clip);
        this.groups.delete(group);
    }

    private async loadAudioGroup(group: string, path: string) {
        const clips = await this.assets.loadDir(path, AudioClip);
        const values = new Map<string, AudioClip>();
        for (const clip of clips) {
            if (values.has(clip.name)) throw new Error(`音频分组【${group}】存在重名资源【${clip.name}】`);
            values.set(clip.name, clip);
        }
        this.groups.set(group, values);
    }

    private getClip(group: string, name: string): AudioClip | undefined {
        return this.groups.get(group)?.get(name);
    }

    private readVolume(key: string): number {
        const value = Number(sys.localStorage.getItem(key));
        return Number.isFinite(value) ? this.normalizeVolume(value) : 1;
    }

    private normalizeVolume(volume: number): number {
        return Math.min(1, Math.max(0, volume));
    }
}
