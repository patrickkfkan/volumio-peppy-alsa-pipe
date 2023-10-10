import { UIConfigButton, UIConfigSelect } from './UIConfig';
export type UIConfigSectionKey = 'section_status' | 'section_mpd_conf';
export type UIConfigSectionContentKeyOf<K extends UIConfigSectionKey> = K extends 'section_status' ? 'status' : K extends 'section_mpd_conf' ? 'modify' : never;
export type UIConfigElementOf<K extends UIConfigSectionKey, C extends UIConfigSectionContentKeyOf<K>> = K extends 'section_status' ? (C extends 'status' ? UIConfigButton<K> : never) : K extends 'section_mpd_conf' ? (C extends 'modify' ? UIConfigSelect<K> : never) : never;
//# sourceMappingURL=UIConfigSchema.d.ts.map