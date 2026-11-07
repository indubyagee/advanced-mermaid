/** YAML reader used only by the test adapter for Obsidian's public parseYaml API. */
declare module 'js-yaml' {
	export const JSON_SCHEMA: object;
	export function load(source: string, options?: { schema?: object }): unknown;
	export function dump(value: unknown, options?: { schema?: object; noRefs?: boolean }): string;
}
