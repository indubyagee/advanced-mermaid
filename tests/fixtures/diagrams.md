# Pele integration fixtures

Use this note in a disposable test vault. No external images should load.
Compare Reading view, rendered Live Preview, active source editing, and embeds.

## Default display and Unicode

```pele
flowchart LR
 A["Source & Ω"] --> B["Rendered diagram"]
```

## Override after frontmatter

```pele
---
title: Local override
---
%% advanced-mermaid: align=right max-height=30vh
flowchart LR
 A --> B
```

## Sequence

```pele
sequenceDiagram
 Alice->>Bob: Hello
 Bob-->>Alice: Ready
```

## Chart series colors

```pele
pie title Distribution
 "First": 40
 "Second": 60
```

## Explicit source colors

```pele
flowchart LR
 A[Authored style] --> B[Theme style]
 style A fill:#123456,color:#ffffff
```

## Tall diagram with unlimited height

```pele
%% advanced-mermaid: max-height=none
flowchart TD
 A --> B --> C --> D --> E --> F --> G --> H --> I --> J
```

## Wide diagram

```pele
flowchart LR
 A --> B --> C --> D --> E --> F --> G --> H --> I --> J
```

## Image privacy

```pele
flowchart LR
 A@{ img: "https://example.com/never-load.png", label: "Image label only" }
```

## Expected configuration failure

```pele
%% advanced-mermaid: max-height=-10px
flowchart LR
 A --> B
```

## Expected syntax failure

```pele
flowchart LR
 A[Unclosed
```

After inspecting the failures, correct each source block. The successful diagrams
above must remain usable. Export before/after zoom, resize, and theme changes;
open the SVG without Obsidian styles and inspect PNG dimensions and colors.
