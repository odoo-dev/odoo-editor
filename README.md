# odoo-editor-poc

Web Editor Proof of Concept

- VDOM == DOM
- Bidirectional Sync: DOM -> vDOM, vDOM -> DOM
- Fast Diff / Patch through MutationObserver
- Allow having a DOM that diverges from VDOM
- Undo / Redo History (=mutations batched by operations)

