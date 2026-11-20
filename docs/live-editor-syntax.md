# Live editor syntax controls

Open a complete top-level `pele` or `mermaid` code block in **Live editor**. The Mermaid source tab provides syntax controls for the active diagram.

| Control | Behavior |
| --- | --- |
| **Diagram** | Select from 33 families and 41 declaration choices, including State variants, C4 levels and Railroad notations. For a family with orientations, this stages the choice. |
| **Orientation** | Select the direction to apply a staged diagram or update its existing direction. The menu is empty for families without a verified direction and stays blank when the source omits an explicit direction. |
| **Component** | Choose a snippet by its name and source syntax. The menu inserts it at the cursor or replaces the selected body text. |
| **Insert configuration** | Add YAML frontmatter at the top of the source, or fill missing configuration keys in existing frontmatter. Selects the resulting YAML for editing. |
| **Syntax Docs** | Open the official syntax page for the selected diagram, including a staged selection. Info opens Pele's diagram reference. |

For example, select **Flowchart**, then choose **TB** from **Orientation**. Place the cursor on the next line and choose **Process (rectangle)** under **Expanded nodes** to insert `A@{ shape: rect, label: process }`. Other groups offer connections, containers, metadata and styles. Insert indented snippets, such as Mindmap branches or Kanban tasks, at the desired nesting level under a parent.

The component list follows the declaration even when it is edited manually. Declaration aliases such as `graph LR` and `agentflow-beta LR` use the corresponding family's snippets. An unrecognized declaration or incomplete frontmatter disables component/configuration insertion until repaired. The controls are hidden in the CSS tab. Active text composition and invalid/conflicting CSS drafts must be resolved before a syntax action can modify the note.

## Preserving source

Selecting a direction writes the family's declaration suffix or top-level `direction` statement. Changing only the orientation preserves the authored keyword, such as `graph`, and leaves nested directions intact. A staged choice pauses component and configuration insertion until the direction is selected, the source is edited, or the previous choice is restored. After switching families, edit any body statements that use the previous family's syntax.

Components use the last source selection even after focus moves to a menu. Body selections are replaced; an empty selection inserts syntax. Statement line breaks and multiline indentation follow the source. Frontmatter and declarations cannot be replaced through the component menu.

Configuration generation retains existing titles, unrelated configuration namespaces, explicit `false`, zero, arrays and null values. Repeated generation does not duplicate a frontmatter block or replace existing values. Block YAML is extended without rewriting comments. Compact or flow-style YAML may be reformatted through Obsidian's YAML serializer; if that would discard comments, the action leaves the source unchanged and asks for block mappings. Invalid YAML is never replaced automatically.

Each action is a single step in the parent note's undo history. Note text outside the source block and the enclosing fence language remain unchanged. These controls do not change plugin settings or type-level frontmatter defaults.

## Configuration compatibility

Templates use the Mermaid 12.3.0 schema as a reference. Options take effect where Pele implements them. Treemap uses the `config.treemap` keys described in its syntax docs. Info receives a general theme example. [Tagged Mermaid schema](https://raw.githubusercontent.com/mermaid-js/mermaid/refs/tags/mermaid%4012.3.0/packages/mermaid/src/schemas/config.schema.yaml) · [Treemap options](https://mermaid.ai/open-source/syntax/treemap.html#configuration-options)

Pele 1.13.0 uses its own layout and CSS-based appearance. Authored `config.themeVariables` palettes work for GitGraph, Mindmap, Timeline, Radar, Treemap, Pie, XY and Venn. Use **Local override** for plugin display and style controls. [Pele compatibility](https://pele.run/compatibility) · [Pele palettes](https://pele.run/theming#series-palettes)

Advanced Mermaid accepts both `agentflow` and `agentflow-beta`. The Diagram chooser inserts `agentflow-beta`, the spelling accepted by the published Mermaid 12.3.0 package in the comparison harness. Use `A@{ shape: input, label: "Intake" }` for Agentflow inputs. Pele 1.13.0 draws the `A[/Intake/]` shorthand as a rounded task. [Agentflow syntax](https://mermaid.ai/open-source/syntax/agentflow.html) · [Reproduce the comparison](technical-reference.md#build-and-test-locally)

Flowchart step animation and number badges, BPMN shapes in Flowchart or Swimlanes, and `mindmap.colorBy: depth` remain renderer gaps. Regular Flowchart edges, nested Swimlane groups, and ER directions and subgraphs are covered by the comparison fixtures. [Mermaid 12.3.0 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.3.0) · [Comparison cases](../scripts/mermaid-reference-cases.mjs)

Mobile loading is disabled. macOS and Linux host behavior remains unverified.
