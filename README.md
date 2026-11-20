# Advanced Mermaid

Edit a Mermaid diagram and see it update in the same Obsidian note. Advanced Mermaid lets you match diagrams to the vault theme, reuse styles and presets across notes, export diagrams as SVG or PNG, and turn a flowchart or Agentflow diagram into an editable Obsidian Canvas.

````markdown
```mermaid
flowchart TD
    A["Write Mermaid"] --> B["Preview diagram"]
    B --> C{"Ready to share?"}
    C -->|Not yet| D["Edit in place"]
    D -.-> B
    C -->|Yes| E["Export SVG or PNG"]
```
````

![Live editor](docs/media/preview-light-flowchart-0.3.3.png)

**Requires Obsidian 1.14.5 or later on desktop.**

## Installation

1. In Obsidian, open **Settings → Community plugins**. If prompted, select **Turn on community plugins**.
2. Select **Browse** and search for **Advanced Mermaid**.
3. Select **Install**, then **Enable**.

[View the Obsidian plugin listing](https://community.obsidian.md/plugins/advanced-mermaid) · [Install manually from GitHub](docs/user-guide.md#install-manually)

## Try a diagram

Copy this block, including the backticks, into a blank note.

````markdown
```mermaid
flowchart LR
    A[Draft] --> B[Review]
    B --> C[Publish]
```
````

In **Live Preview**, add a blank line after the block and move the cursor there to see the flowchart. Select **Live editor** above the diagram and change `Draft` to `Plan` in the source. The preview updates as you type. You can also view the diagram in **Reading view**.

While the plugin is enabled, it renders both `mermaid` and `pele` code blocks using Pele, a Mermaid-compatible renderer. Some diagrams may look different because Pele handles layout and styling in its own way. [Pele compatibility](https://pele.run/compatibility)

## Documentation

- [User Guide](docs/user-guide.md) for editing, styling, exporting, and troubleshooting.
- [Technical reference](docs/technical-reference.md) for configuration syntax, rendering behavior, and development.
- [Contributing](CONTRIBUTING.md) for reporting issues, testing changes, and opening pull requests.
- [Changelog](CHANGELOG.md) for release notes.

## License and credits

Advanced Mermaid and its bundled renderer, Pele, use the MIT license. [Project license](LICENSE) · [Pele source](https://github.com/obsidianmd/pele)

[Support the project on Buy Me a Coffee](https://buymeacoffee.com/indubyagee)

<a href="https://buymeacoffee.com/indubyagee">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" height="30">
</a>
