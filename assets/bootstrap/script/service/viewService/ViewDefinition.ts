import { Component, Constructor } from "cc";
import type { AnyView, BaseView } from "./BaseView";
import type { BaseViewComponent } from "./BaseViewComponent";

export namespace ViewDefinition {
    export interface ViewKey<TView extends AnyView = AnyView> {
        readonly name: string;
        readonly bundle: string;
        readonly assetPath: string;
        readonly viewType?: TView;
    }

    export type AnyViewKey = ViewKey<any>;
    export type ViewInstance<TKey extends AnyViewKey> = TKey extends ViewKey<infer TView> ? TView : never;
    export type ViewParams<TKey extends AnyViewKey> = ViewInstance<TKey> extends BaseView<any, infer TParams> ? TParams : never;

    export function defineView<TView extends AnyView>(name: string, bundle: string, assetPath: string): ViewKey<TView> {
        return { name, bundle, assetPath };
    }

    export interface ViewConstructor {
        readonly ctor: new () => AnyView;
        readonly comp: Constructor<BaseViewComponent<AnyView> | Component>;
        readonly resourceType?: "prefab" | "scene";
        readonly componentNodePath?: string;
        readonly layer?: ViewLayer;
        readonly cache?: boolean;
    }

    export interface ViewConfig extends ViewConstructor {
        readonly name: string;
        readonly bundle: string;
        readonly assetPath: string;
    }

    export interface ViewRegistration {
        readonly key: AnyViewKey;
        readonly config: ViewConstructor;
    }

    export interface ViewSchema {
        readonly entryView: AnyViewKey;
        readonly views: readonly ViewRegistration[];
    }

    export interface ViewRegistry {
        getViewCtor(viewName: string): ViewConstructor | undefined;
    }

    export enum ViewLayer {
        Background,
        Main,
        Popup,
        Guide,
        System,
    }
}
