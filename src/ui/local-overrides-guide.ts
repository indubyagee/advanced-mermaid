import { Setting } from 'obsidian';

export function localOverridesGuide(host: HTMLElement): void {
	new Setting(host).setName('Local overrides').setHeading();
	host.createEl('p', { text: 'Choose rendered view, live editor, or static editor above a complete top-level pele or Mermaid fence in live preview. Static editor opens the original fenced Markdown. Rendered view restores the rendered diagram and keeps focused activation off for that block until you explicitly reopen it. The choice lasts for this note pane session.' });
	host.createEl('p', { text: 'Select a local override to insert valid syntax and edit its selected value. Existing overrides are selected without replacement. Style templates can target both themes, light, or dark; inherited values capture the current appearance.' });
	host.createEl('p', { text: 'Styles inherit from theme → global → type → local. Authored Mermaid styles keep precedence. CSS accepts registered style variables only, with literal hex colors, local fonts, and bounded px lengths.' });
	host.createEl('pre').createEl('code', { text: '%% advanced-mermaid: align=center max-width=wide max-height=50vh\n%% advanced-mermaid-style:v1\n%% .pele { --pele-surface: #153030; }\n%% .theme-dark .pele { --pele-surface: #2D4646; }\n%% advanced-mermaid-style:end\nflowchart LR\n  A --> B' });
	host.createEl('p', { text: 'Only Mermaid source and visible comments are saved. Invalid CSS drafts remain unsaved; use copy draft or discard changes. Unexpected teardown keeps a bounded recovery draft for this application session only. It does not survive application exit.' });
}
