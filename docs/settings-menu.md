# Settings menu

Open **Settings → Community plugins → Advanced Mermaid** and select the plugin's settings.
Changes use the plugin's settings persistence; there is no separate Apply button.

## Menu structure

Obsidian renders native groups and named sub-pages, in this order:

1. **Display settings** — diagram placement and sizing.
2. **Live editor settings** — activation, layout, preview behavior, and the **Editor style settings** page.
3. **Style settings** — theme inheritance, **Global style settings**, and **Diagram-specific style settings** pages.
4. **Preset class settings** — a page for form/text editing and confirmed deletion.
5. **Local overrides and example** — instructions and a lazy preview.

Controls are indexed by Obsidian's settings search. **Editor layout** controls the editor inside a note. Settings navigation uses the host's back control and retains the selected diagram and reset undo within this settings session.

## Display

| Control | New-configuration default | Behavior |
| --- | --- | --- |
| Alignment | Center | Places the diagram left, center, or right. |
| Diagram width | Default | With Minimal Theme Settings enabled, choose Default, Normal, Wide, Maximum, or Full Pane. When absent or disabled, choose Default or Full. Default preserves native sizing. Full fills the text column, and Full Pane uses the usable pane width. The Live editor uses its preview column as the boundary. |
| Maximum height | By orientation | Short (30vh), Medium (50vh), Tall (75vh), None, or Custom. By orientation uses None for landscape/square diagrams and Medium for portrait diagrams. |
| Maintain aspect ratio | On | Fits proportionally within the size limits. Turning it off allows independent width/height fitting when both dimensions are bounded. |
| Fill available space | Off | Enable to enlarge smaller diagrams up to the selected limits. Default width retains native sizing. |

Custom heights accept positive decimal lengths in `vh`, `px`, or `rem`, such as `50vh`, `400px`, or `30rem`. Percentages, expressions, zero, negative, and unitless values are rejected. The reset icon beside maximum height restores orientation defaults.

A diagram's `%% advanced-mermaid:` comment overrides the corresponding global display values. Changing global settings does not rewrite these comments.

Normal, Wide, and Maximum use the active values selected in Minimal Theme Settings. Configure those values in that plugin. Saved MTS presets use Default while MTS is absent or disabled, and saved Full Pane selections use Full.

## Styles

**Follow Obsidian theme** is on by default. Turning it off uses Pele's inherited color defaults while retaining custom light/dark values. Fonts continue to inherit Obsidian's local font families.

Open **Global style settings** to edit common colors, local fonts, label size, corner radius, and shared element defaults. Each color occupies one row with Light/Dark selectors and independent resets. Text fields accept hex, RGB/RGBA, or HSL/HSLA; stored values are hex with alpha. Empty overrides inherit. Base label sizes accept 4–128px; corner radii accept 0–32px. Pixel-size controls combine numeric inputs, sliders, and resets; existing fractional style sizes remain valid.

On **Diagram-specific style settings**, choose a family from **Diagram selection** and turn off **Use global styles** to edit its overrides. Turning inheritance back on retains them. Specialized controls depend on the selected family. Shared Node, Edge, and Subgraph controls open their own pages globally and for Flowchart.

Each of the 16 families also has **Use custom frontmatter** (off by default) and a **Custom frontmatter** YAML field. This toggle works independently of **Use global styles**. Valid YAML saves automatically; invalid drafts show an error and retain the last saved configuration. Disabling the toggle retains the saved YAML. Optional `---` delimiters are accepted. For example, select Flowchart and enter:

```yaml
config:
  flowchart:
    nodeSpacing: 75
    rankSpacing: 100
```

When enabled, these defaults apply to all diagrams in the selected family in Pele reading view, Live editor previews, and exports. Frontmatter authored in a Live editor or source block overrides matching keys recursively; omitted keys inherit, while lists, scalar values and `null` replace their defaults. Source init directives and diagram-body statements retain the renderer's normal precedence. Notes are never rewritten. Native Mermaid views and comparisons follow Obsidian's own configuration.

Use normal Mermaid frontmatter keys such as `title` and `config`, including the correctly capitalized family key (`gitGraph`, `treeView`, `journey`, or `swimlane`, for example). Options take effect only when supported by Pele 1.12.0; accepting YAML does not imply support for every Mermaid option. Configurations are limited to 50,000 characters and bounded nesting; combined render input also follows the renderer's source limit.

- **Reset global styles** clears global style overrides, retaining display, diagram-type, and note styles.
- **Reset this diagram type** clears that type's style overrides and custom frontmatter, and restores global inheritance.
- **Undo reset** restores the previous values for that scope during the current settings session; it is not a persistent backup.

Settings inherit through theme → global → diagram type → local. Authored Mermaid styles retain precedence. See the [README theme guide](https://github.com/indubyagee/advanced-mermaid/blob/main/README.md#theme) for supported controls and palette classes.

### Override reference

Defaults below describe a new configuration with **Follow Obsidian theme** enabled. Overrides start empty; effective colors depend on the active theme. Diagram-specific values inherit global styles unless overridden, and **Use global styles** starts enabled. Light and dark color values inherit independently. Renderer-inherited values are not fixed plugin defaults.

| Setting | Description | Default |
| --- | --- | --- |
| Diagram background | Background behind the diagram. | Inherit Obsidian primary background |
| Primary text | Main diagram labels and text. | Inherit Obsidian normal text |
| Secondary text | Muted or supporting text. | Inherit Obsidian muted text |
| Lines and connectors | Connecting lines and arrows. | Inherit Obsidian normal text color |
| Primary surface | Main shape and panel surface color. | Inherit Obsidian secondary background |
| Secondary surface | Alternate shape and panel surface color. | Inherit Obsidian alternate primary background |
| Borders | General outline and border color. | Inherit Obsidian border color |
| Accent | Highlight and emphasis color. | Inherit Obsidian interactive accent |
| Error color | Error-related diagram color. | Inherit Obsidian error text color |
| Text on light fills | Contrast text used on light authored fills. | Inherit renderer value |
| Text on dark fills | Contrast text used on dark authored fills. | Inherit renderer value |
| Category color 1–8 | Eight palette slots for categories or data series; assignment depends on diagram type. | Inherit renderer palette |
| Diagram font source | Choose inherited text font or a custom local font family. | Use Obsidian font; types use global font |
| Monospace font source | Choose inherited monospace font or a custom local font family. | Use Obsidian font; types use global font |
| Corner radius | Rounding of supported corners, from 0–32px. | Empty; inherit |
| Base label size | Measured base text size, from 4–128px. | Empty; inherit |
| Text weights | Informational row for title, heading, and bold weights; editing is unavailable. | Renderer weights; no override |
| Shared element defaults | Expand legacy node, edge-label, subgraph, and stroke controls where matching elements exist. Available globally and for Flowchart. | Collapsed; no overrides |
| Node fill | Interior color of nodes. | Empty; inherit |
| Node border | Outline color of nodes. | Empty; inherit |
| Node text | Text color inside nodes. | Empty; inherit |
| Edge label fill | Background behind connector labels. | Empty; inherit |
| Edge label text | Text color of connector labels. | Empty; inherit |
| Edge label border | Outline color around connector labels. | Empty; inherit |
| Subgraph fill | Interior color of subgraph containers. | Empty; inherit |
| Subgraph border | Outline color of subgraph containers. | Empty; inherit |
| Subgraph text | Text color of subgraph labels. | Empty; inherit |
| Node border width | Node outline thickness, from 0–20px. | Empty; inherit |
| Edge width | Connector stroke thickness, from 0–20px. | Empty; inherit |
| Edge label border width | Connector-label outline thickness, from 0–20px. | Empty; inherit |
| Subgraph border width | Subgraph outline thickness, from 0–20px. | Empty; inherit |
| Reset global styles | Clears global overrides and legacy theme values; offers Undo reset. | Action; no stored default |

## Live editor

| Control | Default | Behavior |
| --- | --- | --- |
| Enable inline editor | On | Enables inline editing for eligible top-level `pele` and `mermaid` fences in Live Preview. |
| Show line numbers | On | Shows source line numbers. |
| Wrap source | Off | Wraps long source lines. |
| Open editor | Manual | Choose Manual or Focused block activation. |
| Editor layout | Auto | Choose Auto, Side by side, or Stacked. Narrow panes can force stacking even when Side by side is selected. |
| Preview delay | 250 milliseconds | Accepts whole numbers from 100 to 1000. Source edits save immediately; this controls delayed preview work. |
| Editor style settings | Opens a page | Source presentation and editor button styles; the original source size preference is retained. |

### Editor style settings

Live Editor buttons use flat styling with distinct selected states and visible keyboard focus.

| Control | Default | Behavior |
| --- | --- | --- |
| Source font size | 10 px | 8–40 px integer input and slider. Reset or leave empty to inherit the vault text size. Applies to Mermaid and CSS source. |
| Source font color | Inherit | Paired light/dark pickers, literal text fields, and independent resets. Custom text color also colors syntax tokens; reset restores syntax highlighting. |
| Source background color | Inherit | Paired controls for the source background and line-number gutter. |
| Button font size | Empty; inherit interface size | 8–40 px integer input, slider, and reset for editor buttons and export controls. |
| Button corner radius | Empty; inherit theme radius | 0–32 px slider and input for Active, Inactive, and Export buttons and Live editor dropdowns. |
| Button font colors → Active buttons / Inactive buttons / Export button | Inherit | One pair of light/dark color controls per row. Export inherits inactive colors unless separately overridden. |
| Button background colors → Active buttons / Inactive buttons / Export button | Inherit | Same controls for button backgrounds. |
| Button border colors → Active buttons / Inactive buttons / Export button | Inherit | Adds a 1 px border for each configured theme. Export inherits the inactive border if set. |
| Zoom → Use global styles | Off | Bypasses dedicated Zoom colors without deleting them. Uses the normal inherited diagram/editor colors. Custom Zoom rows are hidden while enabled. |
| Zoom → Border color / Font color / Background color | Obsidian interface colors | Dedicated light/dark pickers, text inputs, and resets override all diagram and editor colors on the Zoom controls in every Pele view. |

Live editor dropdowns use the inactive button font, background, and border colors. **Export** and its copy and save buttons use the Export colors, shared button font size, and corner radius in all views. All color fields accept hex, RGB/RGBA and HSL/HSLA with alpha. Empty values inherit independently by theme; invalid drafts retain the saved value. These preferences update open editors and are independent of diagram styles. The page uses Obsidian's usual settings back navigation and search. Close Editor and its settings are no longer displayed; old Close color values remain stored but inactive.

Reading view, source mode, and fences nested inside lists, quotes, or callouts do not become inline editors. See the [inline editor guide](https://github.com/indubyagee/advanced-mermaid/blob/main/README.md#inline-editor) for commands, draft recovery, and comparison limitations.

## Preset class settings

Select an alias to edit or delete it, or select **Create** for a new entry. The form and **Edit preset text** dialog save a complete validated library. Deletion is confirmed; renaming/deleting does not rewrite notes. The generated code block always reflects saved settings. See [preset classes](https://github.com/indubyagee/advanced-mermaid/blob/main/docs/preset-classes.md) for the restricted text format, class syntax in all six supported families, alpha, order, and text-only applicability.

The plugin uses the 42 built-in classes when a vault has no saved preset library. An explicit empty library stays empty after reload. Existing display/style/editor settings and newer-schema overwrite protection remain.

## Local overrides and example

This settings page explains display directives and constrained style comments. The interactive **Local override** selector lives in the inline editor. It inserts missing syntax using the current effective value or selects an existing value without replacement. Style targeting offers Both themes, Light, and Dark. Invalid/conflicting drafts and malformed comments block insertion; valid insertions are one parent-editor undo step.

The settings example refreshes when controls change and is cleaned up when the settings page is hidden.

This guide describes the available controls. Behavior on untested Obsidian versions and devices requires separate validation.
