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

    npm i
    npm run dev


to run in collaborative mode:

    ./server.py

WARNING: collaborative does not work yet with undo.

Devlopment in Odoo
------------------

To build the lib for Odoo we need to generate a build for Odoo as it does not support javascript module
yet.

Install the build library if not already done:
```bash
npm install
```

Build the library:
```bash
npm run build
```
To build contuously as file changes (when developing):
```bash
npm run build -- --watch
```

Then, copy bundle:
```bash
cp <editor_absolute_path>/build/odoo-editor-bundle.js <odoo_absolute_path>/addons/web_editor/static/src/js/editor/odoo-editor.js
```
Or link it (when developing):
```bash
ln -s <editor_absolute_path>/build/odoo-editor-bundle.js <odoo_absolute_path>/addons/web_editor/static/src/js/editor/odoo-editor.js
```

To Improve
----------

Undo should add a reverted step in the history, rather than rollbacking the history; redo support, and
no more issue on collaboration mode. Instead of applying an history step backward: revert the record, and
do a regular apply. Should reduce code by ~20 lines too.

Simple actions (b,u,i) still use execCommand; to implement for cross-browser.

Useful Links
------------

https://danburzo.github.io/input-methods/
