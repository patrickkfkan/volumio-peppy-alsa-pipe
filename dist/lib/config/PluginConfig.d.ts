export type PluginConfigKey = keyof PluginConfigSchema;
export type PluginConfigValue<T extends PluginConfigKey> = PluginConfigSchema[T]['defaultValue'];
export interface PluginConfigSchemaEntry<T, U = false> {
    defaultValue: T;
    json: U;
}
export interface PluginConfigSchema {
    mpdConfModify: PluginConfigSchemaEntry<'peppyBypass' | 'none'>;
}
export declare const PLUGIN_CONFIG_SCHEMA: PluginConfigSchema;
//# sourceMappingURL=PluginConfig.d.ts.map