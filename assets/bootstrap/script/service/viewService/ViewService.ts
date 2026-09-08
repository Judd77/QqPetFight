import { director, error, find, instantiate, log, Node, Prefab, Widget } from "cc";
import type { ServiceLocator } from "../ServiceLocator";
import type { AnyView } from "./BaseView";
import { BaseViewComponent } from "./BaseViewComponent";
import { ViewDefinition } from "./ViewDefinition";

interface LoadingTask {
    promise: Promise<AnyView>;
    componentReadyCallbacks: Array<() => void>;
    componentReady: boolean;
    unloadRequested: boolean;
}

/** 负责 View 的异步加载、并发去重、层级和生命周期。 */
export class ViewService {
    private readonly views = new Map<string, AnyView>();
    private readonly loadingTasks = new Map<string, LoadingTask>();
    private readonly activeViewNames: string[] = [];
    private readonly layers: Node[] = [];

    constructor(
        private readonly services: ServiceLocator,
        private readonly registry: ViewDefinition.ViewRegistry,
    ) {}

    build(facadeNode: Node) {
        const layerCount = Object.keys(ViewDefinition.ViewLayer).filter((key) => Number.isNaN(Number(key))).length;
        for (let i = 0; i < layerCount; i++) {
            const layer = new Node(ViewDefinition.ViewLayer[i]);
            layer.setParent(facadeNode);
            const widget = layer.addComponent(Widget);
            widget.isAlignBottom = true;
            widget.isAlignLeft = true;
            widget.isAlignRight = true;
            widget.isAlignTop = true;
            widget.bottom = 0;
            widget.left = 0;
            widget.right = 0;
            widget.top = 0;
            this.layers.push(layer);
        }
    }

    update(dt: number) {
        for (const name of this.activeViewNames) this.views.get(name)?.update(dt);
    }

    load<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey, ...params: ViewDefinition.ViewParams<TKey>): Promise<ViewDefinition.ViewInstance<TKey>> {
        return this.loadInternal(viewKey, undefined, params);
    }

    loadWithComponentReady<TKey extends ViewDefinition.AnyViewKey>(
        viewKey: TKey,
        onComponentReady: () => void,
        ...params: ViewDefinition.ViewParams<TKey>
    ): Promise<ViewDefinition.ViewInstance<TKey>> {
        return this.loadInternal(viewKey, onComponentReady, params);
    }

    unload(viewKey: ViewDefinition.AnyViewKey) {
        const loading = this.loadingTasks.get(viewKey.name);
        if (loading) {
            loading.unloadRequested = true;
            return;
        }
        this.unloadByName(viewKey.name);
    }

    has(viewKey: ViewDefinition.AnyViewKey): boolean {
        return this.activeViewNames.indexOf(viewKey.name) >= 0;
    }

    isTop(viewKey: ViewDefinition.AnyViewKey): boolean {
        return this.activeViewNames[this.activeViewNames.length - 1] === viewKey.name;
    }

    get<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey): ViewDefinition.ViewInstance<TKey> {
        const view = this.views.get(viewKey.name);
        if (!view) throw new Error(`视图【${viewKey.name}】尚未创建`);
        return view as ViewDefinition.ViewInstance<TKey>;
    }

    tryGet<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey): ViewDefinition.ViewInstance<TKey> | undefined {
        return this.views.get(viewKey.name) as ViewDefinition.ViewInstance<TKey> | undefined;
    }

    destroy() {
        for (let i = this.activeViewNames.length - 1; i >= 0; i--) this.unloadByName(this.activeViewNames[i]!);
        for (const task of this.loadingTasks.values()) task.unloadRequested = true;
        this.loadingTasks.clear();
        this.views.clear();
        for (const layer of this.layers) {
            if (layer.isValid) layer.destroy();
        }
        this.layers.length = 0;
    }

    private async loadInternal<TKey extends ViewDefinition.AnyViewKey>(
        viewKey: TKey,
        onComponentReady: (() => void) | undefined,
        params: ViewDefinition.ViewParams<TKey>,
    ): Promise<ViewDefinition.ViewInstance<TKey>> {
        if (this.has(viewKey)) return this.get(viewKey);

        const existingTask = this.loadingTasks.get(viewKey.name);
        if (existingTask) {
            if (onComponentReady) {
                if (existingTask.componentReady) onComponentReady();
                else existingTask.componentReadyCallbacks.push(onComponentReady);
            }
            return existingTask.promise as Promise<ViewDefinition.ViewInstance<TKey>>;
        }

        const task = {} as LoadingTask;
        task.componentReadyCallbacks = onComponentReady ? [onComponentReady] : [];
        task.componentReady = false;
        task.unloadRequested = false;
        task.promise = this.performLoad(viewKey, params, task);
        this.loadingTasks.set(viewKey.name, task);

        try {
            return (await task.promise) as ViewDefinition.ViewInstance<TKey>;
        } finally {
            if (this.loadingTasks.get(viewKey.name) === task) this.loadingTasks.delete(viewKey.name);
        }
    }

    private async performLoad<TKey extends ViewDefinition.AnyViewKey>(viewKey: TKey, params: ViewDefinition.ViewParams<TKey>, task: LoadingTask): Promise<AnyView> {
        const constructor = this.registry.getViewCtor(viewKey.name);
        if (!constructor) throw new Error(`视图【${viewKey.name}】尚未注册`);

        const view = this.views.get(viewKey.name) ?? new constructor.ctor();
        this.views.set(viewKey.name, view);
        view.serve = this.services;
        view.viewConfig = {
            ...constructor,
            name: viewKey.name,
            bundle: viewKey.bundle,
            assetPath: viewKey.assetPath,
        };
        view.prepare();

        let component: BaseViewComponent<AnyView> | undefined;
        try {
            component = await this.loadComponent(view.viewConfig);
            component.view = view;
            task.componentReady = true;
            for (const callback of task.componentReadyCallbacks.splice(0)) callback();

            await view.load(component, ...params);
            this.activeViewNames.push(viewKey.name);
            log(`加载视图【${viewKey.name}】`);

            if (task.unloadRequested) this.unloadByName(viewKey.name);
            return view;
        } catch (reason) {
            view.unload();
            if (component && view.viewConfig.resourceType !== "scene" && component.node.isValid) component.node.destroy();
            if (view.viewConfig.cache === false) this.views.delete(viewKey.name);
            error(`加载视图【${viewKey.name}】失败`, reason);
            throw reason;
        }
    }

    private async loadComponent(config: ViewDefinition.ViewConfig): Promise<BaseViewComponent<AnyView>> {
        if (config.resourceType === "scene") {
            await this.services.assetService.loadScene(config.bundle, config.assetPath);
            const scene = director.getScene();
            const node = scene && find(config.componentNodePath ?? "Component", scene);
            const component = node?.getComponent(config.comp);
            if (!component) throw new Error(`场景视图【${config.name}】缺少组件节点【${config.componentNodePath ?? "Component"}】`);
            return component as BaseViewComponent<AnyView>;
        }

        const prefab = await this.services.assetService.load(config.bundle, config.assetPath, Prefab);
        const node = instantiate(prefab);
        const layer = config.layer ?? ViewDefinition.ViewLayer.Main;
        const parent = this.layers[layer];
        if (!parent) throw new Error(`视图层级无效：${layer}`);
        parent.addChild(node);

        const component = node.getComponent(config.comp);
        if (!component) {
            node.destroy();
            throw new Error(`预制体视图【${config.name}】缺少指定组件`);
        }
        return component as BaseViewComponent<AnyView>;
    }

    private unloadByName(viewName: string) {
        const activeIndex = this.activeViewNames.indexOf(viewName);
        if (activeIndex < 0) return;
        const view = this.views.get(viewName);
        if (!view) return;

        if (view.viewConfig.resourceType !== "scene" && view.component.node.isValid) view.component.node.destroy();
        view.unload();
        this.activeViewNames.splice(activeIndex, 1);
        if (view.viewConfig.cache === false) this.views.delete(viewName);
        log(`卸载视图【${viewName}】`);
    }
}
