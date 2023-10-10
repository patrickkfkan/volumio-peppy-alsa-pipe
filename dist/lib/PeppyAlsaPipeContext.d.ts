import I18nSchema from '../i18n/strings_en.json';
import winston from 'winston';
import { PluginConfigKey, PluginConfigValue } from './config/PluginConfig';
export type I18nKey = keyof typeof I18nSchema;
declare class PeppyAlsaPipeContext {
    #private;
    constructor();
    set<T>(key: string, value: T): void;
    get<T>(key: string): T | null;
    get<T>(key: string, defaultValue: T): T;
    delete(key: string): void;
    init(pluginContext: any, pluginConfig: any): void;
    toast(type: 'success' | 'info' | 'error' | 'warning', message: string, title?: string): void;
    refreshUIConfig(): void;
    getLogger(): winston.Logger;
    getErrorMessage(message: string, error: any, stack?: boolean): string;
    hasConfigKey<T extends PluginConfigKey>(key: T): boolean;
    getConfigValue<T extends PluginConfigKey>(key: T): PluginConfigValue<T>;
    deleteConfigValue(key: string): void;
    setConfigValue<T extends PluginConfigKey>(key: T, value: PluginConfigValue<T>): void;
    getMpdPlugin(): any;
    getStateMachine(): any;
    getAlsaController(): any;
    getVolumioSharedVars(): any;
    reset(): void;
    getI18n(key: I18nKey, ...formatValues: any[]): string;
    get volumioCoreCommand(): any;
}
declare const _default: PeppyAlsaPipeContext;
export default _default;
//# sourceMappingURL=PeppyAlsaPipeContext.d.ts.map