import { Component } from "cc";
import type { ServiceLocator } from "../ServiceLocator";
import type { BaseController } from "./BaseController";
import { ViewDefinition } from "./ViewDefinition";

/** 管理界面生命周期和 Controller 编排。 */
export abstract class BaseView<TComponent extends Component = Component, TParams extends unknown[] = []> {
    declare serve: ServiceLocator;
    declare component: TComponent;
    declare viewConfig: ViewDefinition.ViewConfig;
    hasLoaded = false;
    isLoaded = false;

    protected readonly controllers: BaseController<any>[] = [];

    private loadedControllerCount = 0;
    private prepared = false;

    prepare() {
        if (this.prepared || this.isLoaded) throw new Error(`视图【${this.viewConfig.name}】生命周期状态异常`);
        this.prepared = true;
        this.onBeforeLoad();
    }

    async load(component: TComponent, ...params: TParams) {
        this.component = component;
        this.isLoaded = true;
        try {
            for (const controller of this.controllers) {
                await controller.load();
                this.loadedControllerCount++;
            }
            await this.onLoad(...params);
            this.hasLoaded = true;
        } catch (error) {
            this.rollback();
            throw error;
        }
    }

    unload() {
        if (!this.prepared && !this.isLoaded) return;
        try {
            if (this.isLoaded) this.onUnload();
        } finally {
            this.rollback();
        }
    }

    cancelLoad() {
        this.rollback();
    }

    update(dt: number) {
        if (!this.isLoaded) return;
        for (const controller of this.controllers) controller.update(dt);
        this.onUpdate(dt);
    }

    protected onBeforeLoad() {}
    protected abstract onLoad(...params: TParams): void | Promise<void>;
    protected onUnload() {}
    protected onUpdate(_dt: number) {}

    private rollback() {
        for (let i = this.loadedControllerCount - 1; i >= 0; i--) this.controllers[i]!.unload();
        this.loadedControllerCount = 0;
        this.prepared = false;
        this.isLoaded = false;
        this.component = undefined!;
    }
}

export type AnyView = BaseView<any, any[]>;
