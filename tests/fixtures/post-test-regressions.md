# Post-test regression checks

These local overrides exercise the new defaults even when older saved settings
retain a height limit or have enlargement disabled. Compare Reading view and
rendered Live Preview. Keep the original test notes unchanged.

## Landscape sizing and export placement

```pele
%% advanced-mermaid: max-width=normal max-height=auto fill=true
flowchart LR
 A[Node] --- B[Node]
 B --- C[Node]
 C --- D[Node]
```

Change max-height through 1vh, 2vh, 4vh, 5vh, 10vh, 25vh, 50vh, 100vh, then
back to 4vh. Increasing the cap must not shrink the diagram. The two 4vh
results must match. Export must stay below the diagram and away from Edit.
Try Normal, Wide, Maximum, and None widths in wide and narrow split panes.

## Portrait defaults

```pele
%% advanced-mermaid: max-width=auto max-height=auto fill=true
flowchart TD
 A[Node] --- B[Node]
 B --- C[Node]
 C --- D[Node]
```

Repeat the height sequence. Confirm the orientation default caps height at
50vh. Resize the pane and app window. No part may exceed the available width.

## Independent bounded dimensions

```pele
%% advanced-mermaid: max-width=normal max-height=short aspect-ratio=false fill=true
flowchart LR
 A[Deliberately stretched] --> B[Independent dimensions]
```

This case intentionally distorts the drawing. Set aspect-ratio=true to restore
proportions. Exports always use the intrinsic, undistorted layout.

## Canonical palette, nested subgraphs, and authored precedence

```pele
%% advanced-mermaid: max-width=wide max-height=auto fill=true
flowchart LR
 subgraph GROUP[Palette group]
  A[Default gray]:::PRESET1 -->|normal| B[Alternate gray]:::PRESET2
  B --> C[Cyan]:::PRESET3
  C --> D[Green]:::PRESET4
  D --> E[Red]:::PRESET5
  E --> F[Purple]:::PRESET6
  F --> G[Yellow]:::PRESET7
  G --> H[Magenta]:::PRESET8
  H --> I[Authored color]:::PRESET3
 end
 class GROUP PRESET2
 style I fill:#123456,color:#ffffff,stroke:#abcdef,stroke-width:3px
```

Palette colors are opaque. The last node keeps its authored colors. Confirm
the same appearance after SVG/PNG save and reopening outside Obsidian.

## Theme and folder controls

1. Open the plugin settings. Test each color picker, valid/invalid hex text,
   alpha retention, reset, and settings persistence after plugin reload.
2. Test canvas background separately from node/subgraph fill. Test the base
   label size with both short and long labels; no text should be clipped.
3. Expand Export and use all four actions. For saving, type part of a nested
   folder, select it with pointer and keyboard, and check the preview.
4. Select Vault root. Try an invalid path, cancellation, and a repeated save.
   Existing files must remain untouched.
5. Repeat in light/dark themes. Test zoom, source-error recovery, an embed,
   a pop-out pane, and a plugin reload. Record app, OS, theme, and view mode.
