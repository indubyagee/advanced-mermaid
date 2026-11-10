# Live editor syntax controls

Open a complete top-level `pele` or `mermaid` code block in **Live editor**. The Mermaid source tab has three syntax controls. They work locally and do not require additional settings.

| Control | Behavior |
| --- | --- |
| **Diagram** | Select from 33 renderer families and 55 declaration choices, including Flowchart directions, C4 levels and Railroad notations. Updates the declaration or initializes an empty source. |
| **Component** | Select a diagram-specific snippet to insert at the source position or replace selected body text. The placeholder resets so the same snippet can be inserted again. |
| **Insert configuration** | Add YAML frontmatter at the top of the source, or fill missing configuration keys in existing frontmatter. Selects the resulting YAML for editing. |

For example, select **Flowchart TB**, place the cursor on the next line, and select `A["node"]` or `A@{ shape: rect, label: process }` from **Component**. Both produce a rectangular node. Other groups offer connections, containers, metadata and styles. Indented snippets such as Mindmap branches or Kanban tasks need the appropriate parent structure; insert them at the desired nesting level.

The component list follows the declaration even when it is edited manually. Declaration aliases such as `graph LR` use the corresponding family's snippets. An unrecognized declaration or incomplete frontmatter disables component/configuration insertion until repaired. The controls are hidden in the CSS tab. Active text composition and invalid/conflicting CSS drafts must be resolved before a syntax action can modify the note.

## Preserving source

Diagram selection changes only the declaration. Frontmatter, leading comments, style directives and body statements remain. When switching families, edit any retained statements that use the previous family's syntax.

Components use the last source selection even after focus moves to a menu. Body selections are replaced; an empty selection inserts syntax. Statement line breaks and multiline indentation follow the source. Frontmatter and declarations cannot be replaced through the component menu.

Configuration generation retains existing titles, unrelated configuration namespaces, explicit `false`, zero, arrays and null values. Repeated generation does not duplicate a frontmatter block or replace existing values. Block YAML is extended without rewriting comments. Compact or flow-style YAML may be reformatted through Obsidian's YAML serializer; if that would discard comments, the action leaves the source unchanged and asks for block mappings. Invalid YAML is never replaced automatically.

Each action is a single step in the parent note's undo history. Note text outside the source block and the enclosing fence language remain unchanged. These controls do not change plugin settings or type-level frontmatter defaults.

## Configuration compatibility

Templates provide editable Mermaid configuration values. The fields for families with project variable tables follow those tables, excluding newer syntax unsupported by the pinned renderer. Additional families use the [Mermaid 12.1 configuration schema](https://github.com/mermaid-js/mermaid/blob/mermaid%4012.1.0/packages/mermaid/src/schemas/config.schema.yaml). Treemap's `config.treemap` fields are consumed by Pele even though that namespace is absent from the pinned Mermaid schema. Info has no diagram-specific configuration fields and receives a general theme example.

Pele 1.12.0 supports a subset of Mermaid configuration and uses its own layout and CSS-based appearance. Some generated keys have no visible effect. Use **Local override** for the plugin's display and style controls. [Pele compatibility](https://pele.run/compatibility)

Mobile loading is disabled. macOS and Linux host behavior remains unverified.
