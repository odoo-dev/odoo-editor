# odoo-editor-poc

Web Editor Proof of Concept

- VDOM == DOM
- Bidirectional Sync: DOM -> vDOM, vDOM -> DOM
- Fast Diff / Patch through MutationObserver
- Allow having a DOM that diverges from VDOM
- Undo / Redo History (redo in progress)
- Unbreakable
- floating toolbar on selection
- Collaborative mode


Usage
-----

to run in standalone mode (from this directory):

    python -m SimpleHTTPServer 8000


to run in collaborative mode:

    ./server.py

WARNING: collaborative does not work yet with undo.


To Improve
----------

Undo should add a reverted step in the history, rather than rollbacking the history; redo support, and
no more issue on collaboration mode. Instead of applying an history step backward: revert the record, and
do a regular apply. Should reduce code by ~20 lines too.

Simple actions (b,u,i) still use execCommand; to implement for cross-browser.

Useful Links
------------

https://danburzo.github.io/input-methods/
