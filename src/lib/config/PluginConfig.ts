export type PluginConfigKey = keyof PluginConfigSchema;
export type PluginConfigValue<T extends PluginConfigKey> = PluginConfigSchema[T]['defaultValue'];

export interface PluginConfigSchemaEntry<T, U = false> {
  defaultValue: T;
  json: U;
}

export interface PluginConfigSchema {
  mpdConfModify: PluginConfigSchemaEntry<'peppyBypass' | 'none'>;
}

export const PLUGIN_CONFIG_SCHEMA: PluginConfigSchema = {
  mpdConfModify: { defaultValue: 'peppyBypass', json: false }
};
