# Settings menu

Open **Settings → Community plugins → Advanced Mermaid** and select the plugin's settings.
Changes save automatically.

## Menu structure

Obsidian renders native groups and named sub-pages, in this order:

1. **General** contains **About**, **Zoom controls**, **Preset classes**, and **Help**. Open **About** to see the installed version.
2. **Live Editor** covers activation, layout, and source options. Open **Editor appearance** for fonts and button colors or **Preview timing** for the preview delay.
3. **Diagram Display** covers alignment, maximum width, and maximum height.
4. **Diagram Styles** provides theme inheritance, shared defaults under **All diagrams**, and overrides under **By diagram type**.

Use Obsidian's **Search settings** to look up controls by name or by terms such as `text wrap`, `line thickness`, and `zoom colors`. Select **Show example** in **Diagram Display**, **All diagrams**, or a diagram type page to see your changes. **All diagrams** previews the shared defaults. Each diagram type page previews its own styles and frontmatter.

Use **Back** or press **Alt + Left Arrow** from a page outside a text field. Focus returns to the entry you opened.

## Display

| Control | New-configuration default | Behavior |
| --- | --- | --- |
| Diagram alignment | Center | Places the diagram left, center, or right. |
| Diagram max width | Default | With Minimal Theme Settings enabled, choose Default, Normal, Wide, Maximum, or Full Pane. When absent or disabled, choose Default or Full. Default preserves native sizing. Full fills the text column, and Full Pane uses the usable pane width. The Live editor uses its preview column as the boundary. |
| Diagram max height | By orientation | Short (30vh), Medium (50vh), Tall (75vh), None, or Custom. By orientation uses None for landscape/square diagrams and Medium for portrait diagrams. |
| Maintain aspect ratio | On | Fits proportionally within the size limits. Turning it off allows independent width/height fitting when both dimensions are bounded. |
| Fill available space | Off | Enable to enlarge smaller diagrams up to the selected limits. Default width retains native sizing. |

Custom heights accept positive decimal lengths in `vh`, `px`, or `rem`, such as `50vh`, `400px`, or `30rem`. Percentages, expressions, zero, negative, and unitless values are rejected. The reset icon beside **Diagram max height** restores orientation defaults.

A diagram's `%% advanced-mermaid:` comment overrides the corresponding global display values. Changing global settings does not rewrite these comments.

Normal, Wide, and Maximum use the active values selected in Minimal Theme Settings. Configure those values in that plugin. Saved MTS presets use Default while MTS is absent or disabled, and saved Full Pane selections use Full.

## Styles

**Follow Obsidian theme** is on by default. Turning it off uses Pele's inherited color defaults while retaining custom light/dark values. Fonts continue to inherit Obsidian's local font families.

Open **All diagrams** to edit common colors, local fonts, label size, corner radius, and shared element defaults. Each color occupies one row with Light/Dark selectors and independent resets. Text fields accept hex, RGB/RGBA, or HSL/HSLA and save as hex with alpha. Empty overrides inherit. Base label sizes accept 4–128 px and corner radii accept 0–32 px. Pixel-size controls combine numeric inputs, sliders, and resets. Fractional style sizes are supported.

Under **By diagram type**, open a family such as **Flowchart** and turn off **Use styles from All diagrams** to edit its overrides. Empty values inherit from **All diagrams**. Turning inheritance back on retains your custom values. Specialized controls depend on the family. **Nodes**, **Edges**, and **Subgraphs** have their own pages under **All diagrams** and **Flowchart**.

Open **Advanced** for the eight category colors. On each diagram type page, **Advanced** also contains **Use custom frontmatter** (off by default) and the **Custom frontmatter** YAML field. Frontmatter can apply while styles inherit from **All diagrams**. Valid YAML saves automatically. Invalid drafts show an error and retain the last saved configuration. Disabling the toggle retains the saved YAML. Optional `---` delimiters are accepted. For example, open **Flowchart → Advanced** and enter the following YAML.

```yaml
config:
  flowchart:
    nodeSpacing: 75
    rankSpacing: 100
```

When enabled, these defaults apply to all diagrams in the selected family in Pele reading view, Live editor previews, and exports. Frontmatter authored in a Live editor or source block overrides matching keys recursively; omitted keys inherit, while lists, scalar values and `null` replace their defaults. Source init directives and diagram-body statements retain the renderer's normal precedence. Notes are never rewritten. Native Mermaid views and comparisons follow Obsidian's own configuration.

Use normal Mermaid frontmatter keys such as `title` and `config`, including the correctly capitalized family key (`gitGraph`, `treeView`, `journey`, or `swimlane`, for example). Options take effect only when supported by Pele 1.12.0; accepting YAML does not imply support for every Mermaid option. Configurations are limited to 50,000 characters and bounded nesting; combined render input also follows the renderer's source limit.

- **Reset shared styles** clears the defaults set under **All diagrams**.
- Each diagram type has a labeled reset such as **Reset Flowchart styles**. It clears that type's overrides and custom frontmatter and restores inheritance from **All diagrams**.
- **Undo reset** appears beside the reset confirmation and restores the previous values during that settings session.

Settings inherit through theme → global → diagram type → local. Authored Mermaid styles retain precedence. See the [README theme guide](https://github.com/indubyagee/advanced-mermaid/blob/main/README.md#theme) for supported controls and palette classes.

### Override reference

Defaults below describe a new configuration with **Follow Obsidian theme** enabled. Overrides start empty; effective colors depend on the active theme. Diagram-specific values inherit global styles unless overridden, and **Use global styles** starts enabled. Light and dark color values inherit independently. Renderer-inherited values are not fixed plugin defaults.

| Setting | Description | Default |
| --- | --- | --- |
| Diagram background | Background behind the diagram. | Inherit Obsidian primary background |
| Primary text | Main diagram labels and text. | Inherit Obsidian normal text |
| Secondary text | Muted or supporting text. | Inherit Obsidian muted text |
| Lines and connectors | Connecting lines and arrows. | Inherit Obsidian accent color |
| Primary surface | Main shape and panel surface color. | Inherit Obsidian primary background |
| Secondary surface | Alternate shape and panel surface color. | Inherit Obsidian accent color |
| Borders | General outline and border color. | Inherit Obsidian accent color |
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
| Shared element defaults | Open **Nodes**, **Edges**, or **Subgraphs** to edit defaults for matching elements in **All diagrams** and **Flowchart**. | Empty, inherit |
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
| Reset shared styles | Clears shared overrides and offers **Undo reset**. | Action |

## Live Editor

| Control | Default | Behavior |
| --- | --- | --- |
| Enable inline editor | On | Enables inline editing for eligible top-level `pele` and `mermaid` fences in Live Preview. |
| Show line numbers | On | Shows source line numbers. |
| Wrap source | Off | Wraps long source lines. |
| Open editor | Manual | Choose Manual or Focused block activation. |
| Editor layout | Auto | Choose Auto, Side by side, or Stacked. Narrow panes can force stacking even when Side by side is selected. |
| Preview timing → Preview delay | 250 milliseconds | Accepts whole numbers from 100 to 1000. Source edits save immediately. |
| Editor appearance | Opens a page | Source, editor button, and Export styles. |

### Editor appearance

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

Live editor dropdowns use the inactive button font, background, and border colors. **Export** and its copy and save buttons use the Export colors, shared button font size, and corner radius in all views. All color fields accept hex, RGB/RGBA and HSL/HSLA with alpha. Empty values inherit independently by theme; invalid drafts retain the saved value. These preferences update open editors and are independent of diagram styles. The page uses Obsidian's usual settings back navigation and search. Close Editor and its settings are no longer displayed; old Close color values remain stored but inactive.

Reading view, source mode, and fences nested inside lists, quotes, or callouts do not become inline editors. See the [inline editor guide](https://github.com/indubyagee/advanced-mermaid/blob/main/README.md#inline-editor) for commands, draft recovery, and comparison limitations.

## Zoom controls

**Zoom border color**, **Zoom font color**, and **Zoom background color** apply to Zoom controls in every Pele view. Empty values use the Obsidian interface colors. Turn on **Use inherited colors** to take colors from diagram and editor styles. Saved Zoom overrides are retained and reappear when the toggle is off.

## Preset classes

Select an alias to edit or delete it, or select **Create preset** for a new entry. The form and **Edit preset text** dialog save a complete validated library. Deletion requires confirmation. **Show generated code** displays the saved library as read-only text. The [preset class guide](https://github.com/indubyagee/advanced-mermaid/blob/main/docs/preset-classes.md) explains the text format and syntax for the six supported diagram types.

The plugin uses the 42 built-in classes when a vault has no saved preset library. An explicit empty library stays empty after reload. Existing display/style/editor settings and newer-schema overwrite protection remain.

## Help

This settings page explains display directives and constrained style comments. The interactive **Local override** selector lives in the inline editor. It inserts missing syntax using the current effective value or selects an existing value without replacement. Style targeting offers Both themes, Light, and Dark. Invalid/conflicting drafts and malformed comments block insertion; valid insertions are one parent-editor undo step.

An open example refreshes as you change settings. Collapsing it or leaving the page releases the renderer.

This guide describes the available controls. Behavior on untested Obsidian versions and devices requires separate validation.
