# Changelog

## Unreleased

- Add Live Editor diagram selection for all 33 Pele families, diagram-specific component snippets at the source selection, and frontmatter configuration generation with authored-value preservation and parent undo/redo.
- Add optional custom YAML frontmatter for each diagram family, with source-block overrides, validation, and scoped reset/undo.
- Use Advanced Mermaid consistently in plugin metadata, controls, code identifiers, note directives, and CSS variables.
- Bound diagram source before preprocessing and scan YAML frontmatter without repeated prefix work.
- Keep internal records and machine-specific information out of public source and package artifacts.

## 0.2.2 — 2026-11-01

- Restore cached Markdown previews when returning from Live Editor to Rendered View. Suspended children retain the latest source and resume after ownership release, including delayed processors and edits before a block.
- Order mode controls as Rendered View, Live Editor, Static Editor, and isolate their input events from note handlers.
- Center Export text within the button at the configured control height.
- Add independent Zoom border, font and background color pairs, plus Use global styles. Dedicated Zoom colors override diagram/editor colors by default.
- Remove the redundant Close Editor button and visible color controls; retain previous saved Close colors as inactive compatibility values.

## 0.2.1 — 2026-11-01

- Add Rendered View beside Live Editor and Static Editor. Closing Live Editor moves the note cursor outside its fence and selects Rendered View.
- Add Tab/Shift+Tab indentation, isolate source editing keys, and preserve the parent viewport during source edits and parent cursor-scroll requests.
- Keep zoom in/out/reset controls visible on every rendered Pele diagram, with a separate control rail and pan after zooming.
- Add Editor style settings under Live editor settings, retaining the source size preference and adding source colors, button size, and paired button text/background colors for active, inactive, Close, and Export controls.
- Match Export typography to editor buttons and reduce status/details text.

## 0.2.0 — 2026-11-01

### Added

- Native settings pages, settings search, control descriptions, paired theme colors, and numeric sliders with inheritance resets.
- Editable preset classes with form/text editors, alpha colors, confirmed deletion, and support for six diagram families.
- Static/Live editor choices for both `pele` and `mermaid` fences, remembered per block within an open note pane.
- Local display/style override insertion with existing-value selection and one parent undo step.

### Changed

- Settings schema 4 preserves earlier preferences and initializes the original eight presets only when a library is absent.
- Presets use validated SVG variables and static CSS for consistent live and exported styles. Inactive Mermaid blocks retain native rendering.

### Fixed

- Custom subgraph fills use their intended full opacity.
- Inserting text before a diagram retains its editor and draft state.
