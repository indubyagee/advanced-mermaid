# Changelog

## 0.3.1 — 2026-11-13

### Added

- Render both `mermaid` and `pele` code blocks with Advanced Mermaid, sharing display settings, styles, exports, and inline editor handoff.
- Add Default and Full diagram width options, with Normal, Wide, Maximum, and Full Pane available when Minimal Theme Settings is enabled.
- Add separate light and dark border colors for active, inactive, and Export buttons, plus a shared button corner-radius setting from 0–32 px.
- Expand the built-in preset library to 42 classes, including `PRESET1`–`PRESET8`, `CATEGORY1`–`CATEGORY8`, highlights, notes, statuses, and diagram roles. Existing saved libraries, including empty ones, are preserved.

### Changed

- Default the Live Editor source font size to 10 px, preserving saved sizes and the option to inherit the vault text size.
- Apply custom settings and local overrides to rendered `mermaid` blocks in Live Preview, including when the optional inline editor is disabled.
- Use active Minimal Theme Settings (MTS) values for Normal, Wide, and Maximum. Default preserves native width, Full uses the text column, and Full Pane uses the usable pane width.
- Default to native diagram width with **Fill available space** off. Preserve explicitly saved fill choices and migrate saved orientation-based global widths to Default. Local `max-width=auto` overrides remain available.
- Fit diagrams to their usable pane or Live Editor preview column without changing the note's reading width. In Reading view and rendered Live Preview, zoom and pan use the diagram block; zoom controls appear at the bottom right for left-aligned diagrams and at the bottom left for centered or right-aligned diagrams.
- Use flat styling for Live Editor buttons and dropdowns. Apply Export colors, button font size, and corner radius to Export and its copy and save controls across views.
- Document development builds, validation commands, width inheritance, and the limits of recorded 0.3.0 host acceptance for 0.3.1.

### Fixed

- Treat disabled MTS as absent in Reading view, Live Preview, and settings. Offer only Default and Full, and ignore saved MTS width values.
- Refresh the diagram width choices when settings reopen after MTS is enabled or disabled, including cached settings definitions.

### Removed

- Remove native Mermaid comparison from the Live Editor. Pele and read-only SVG previews remain available.
- Remove the separate Normal, Wide, and Maximum line-width controls. Configure those values in MTS.

## 0.3.0 — 2026-11-07

- Add Live Editor diagram selection for all 33 Pele families, diagram-specific component snippets at the source selection, and frontmatter configuration generation with authored-value preservation and parent undo/redo.
- Add optional custom YAML frontmatter for each diagram family, with source-block overrides, validation, and scoped reset/undo.
- Use Advanced Mermaid consistently in plugin metadata, controls, code identifiers, note directives, and CSS variables.
- Bound diagram source before preprocessing and scan YAML frontmatter without repeated prefix work.
- Keep internal records and machine-specific information out of public source and package artifacts.

- Launch as a desktop-only community plugin candidate with complete bundled license notices and validated release artifacts.

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
