"use strict";

import {} from "./commands/deleteBackward.js";
import {} from "./commands/deleteForward.js";
import {} from "./commands/enter.js";
import {} from "./commands/shiftEnter.js";
import {} from "./commands/shiftTab.js";
import {} from "./commands/tab.js";

import {sanitize} from "./utils/sanitize.js";
import {
    nodeToObject,
    objectToNode,
} from "./utils/serialize.js";
import {
    commonParentGet,
    containsUnbreakable,
    inUnbreakable,
    parentBlock,
    setCursor,
    setTagName,
} from "./utils/utils.js";

export const UNBREAKABLE_ROLLBACK_CODE = 100;

export default class OdooEditor {
    constructor(dom) {
        dom.oid = 1; // convention: root node is ID 1
        this.dom = sanitize(dom);
        this.history = [{
            cursor: { // cursor at beginning of step
                anchorNode: undefined, anchorOffset: undefined,
                focusNode: undefined, focusOffset: undefined,
            },
            dom: [],
            id: undefined
        }];
        this.undo_index = 1;
        this.vdom = dom.cloneNode(true);
        this.idSet(dom, this.vdom);

        dom.setAttribute("contentEditable", true);
        this.observerActive();

        this.dom.addEventListener('keydown', this._onKeyDown.bind(this));
        this.dom.addEventListener('input', this._onInput.bind(this));

        document.onselectionchange = this._onSelectionChange.bind(this);

        this.toolbar = document.querySelector('#toolbar');
        this.toolbar.addEventListener('click', this._onToolbarClick.bind(this));

        this.collaborate = true;
        this.collaborate_last = null;

        // used to check if we have to rollback an operation as an unbreakable is
        this.torollback = false; // unbreakable removed or added
        this.unbreaks = new Set(); // modified unbreakables from vDOM, should not be more than one per step
    }
    /**
     * Releases anything that was initialized.
     *
     * TODO: properly implement this.
     */
    destroy() {
        this.observerUnactive();
    }

    sanitize() {
        // find common ancestror in this.history[-1]
        let step = this.history[this.history.length - 1];
        let ca, record;
        for (record of step.dom) {
            let node = this.idFind(this.dom, record.parentId || record.id) || this.dom;
            ca = ca ? commonParentGet(ca, node, this.dom) : node;
        }
        if (!ca) {
            return false;
        }

        // sanitize and mark current position as sanitized
        sanitize(ca);
    }

    //
    // VDOM Processing
    //
    idSet(src, dest) {
        if (src.oid) {
            dest.oid = src.oid;
        } else {
            // TODO: use a real UUID4 generator
            src.oid = dest.oid = Math.random() * 2 ** 31 | 0;
        }
        let childsrc = src.firstChild;
        let childdest = dest.firstChild;
        while (childsrc) {
            this.idSet(childsrc, childdest);
            childsrc = childsrc.nextSibling;
            childdest = childdest.nextSibling;
        }
    }

    // TODO: improve to avoid traversing the whole DOM just to find a node of an ID
    idFind(dom, id, parentid) {
        if (dom.oid === id && (!parentid || dom.parentNode.oid === parentid)) {
            return dom;
        }
        let cur = dom.firstChild;
        while (cur) {
            if (dom.oid === id && ((!parentid) || dom.parentNode.oid === parentid)) {
                return dom;
            }
            let result = this.idFind(cur, id, parentid);
            if (result) {
                return result;
            }
            cur = cur.nextSibling;
        }
    }

    // Observer that syncs doms

    // if not in collaboration mode, no need to serialize / unserialize
    serialize(node) {
        if (this.collaborate) {
            return nodeToObject(node);
        }
        return node;
    }
    unserialize(obj) {
        return this.collaborate ? objectToNode(obj) : obj;
    }

    observerUnactive() {
        this.observer.disconnect();
        this.observerFlush();
    }
    observerFlush() {
        let records = this.observer.takeRecords();
        this.observerApply(this.vdom, records);
    }
    observerActive() {
        this.observer = new MutationObserver(records => {
            this.observerApply(this.vdom, records);
        });
        this.observer.observe(this.dom, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            characterDataOldValue: true,
        });
    }

    // TODO: refactor this method to use history apply, in 2 steps:
    //    1) transform observerRecord -> historyRecord
    //    2) apply historyRecord
    observerApply(destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": {
                    let node = this.idFind(destel, record.target.oid);
                    if (node) {
                        this.history[this.history.length - 1].dom.push({
                            'type': "characterData",
                            'id': record.target.oid,
                            "text": record.target.textContent,
                            "oldValue": node.textContent
                        });
                        node.textContent = record.target.textContent;
                        this.unbreaks.add(inUnbreakable(node));
                    }
                    break;
                }
                case "childList": {
                    record.removedNodes.forEach((removed, index) => {
                        this.history[this.history.length - 1].dom.push({
                            'type': "remove",
                            'id': removed.oid,
                            'parentId': record.target.oid,
                            'node': this.serialize(removed),
                            'nextId': record.nextSibling ? record.nextSibling.oid : undefined,
                            'previousId': record.previousSibling ? record.previousSibling.oid : undefined,
                        });
                        let toremove = this.idFind(destel, removed.oid, record.target.oid);
                        this.unbreaks.add(inUnbreakable(toremove));
                        if (toremove) {
                            toremove.remove();
                        }
                    });
                    record.addedNodes.forEach((added, index) => {
                        if (!record.target.oid) {
                            return false;
                        }
                        if (added.oid && this.idFind(destel, added.oid)
                                && record.target.oid === this.idFind(destel, added.oid).parentNode.oid) {
                            return false;
                        }
                        this.torollback |= containsUnbreakable(added);

                        let newnode = added.cloneNode(1);
                        let action = {
                            'type': "add",
                        };
                        if (!record.nextSibling) {
                            this.idFind(destel, record.target.oid).append(newnode);
                            action['append'] = record.target.oid;
                        } else if (record.nextSibling.oid) {
                            this.idFind(destel, record.nextSibling.oid).before(newnode);
                            action['before'] = record.nextSibling.oid;
                        } else if (record.previousSibling.oid) {
                            this.idFind(destel, record.previousSibling.oid).after(newnode);
                            action['after'] = record.previousSibling.oid;
                        } else {
                            return false;
                        }
                        this.idSet(added, newnode);
                        this.unbreaks.add(inUnbreakable(newnode));
                        action['id'] = added.oid;
                        action['node'] = this.serialize(newnode);
                        this.history[this.history.length - 1].dom.push(action);
                    });
                    break;
                }
                default: {
                    console.log(`Unknown mutation type: ${record.type}`);
                }
            }
        }
    }

    //
    // History
    //

    // One operation of several changes completed, go to next one
    historyStep() {
        // check that not two unBreakables modified
        this.unbreaks.delete(null);
        if (this.torollback || this.unbreaks.length > 1) {
            this.historyRollback();
        }
        this.torollback = false;
        this.unbreaks = new Set();

        // push history
        let latest = this.history[this.history.length - 1];
        if (!latest.dom.length) {
            return false;
        }

        latest.id = Math.random() * 2 ** 31 | 0; // TODO: replace by uuid4 generator
        this.historySend(latest);
        this.history.push({
            cursor: {},
            dom: [],
        });
        this._recordHistoryCursor();
    }

    // apply changes according to some records
    historyApply(destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": {
                    let node = this.idFind(destel, record.id);
                    if (node) {
                        node.textContent = record.text;
                    }
                    break;
                }
                case "remove": {
                    let toremove = this.idFind(destel, record.id, record.parentId);
                    if (toremove) {
                        toremove.remove();
                    }
                    break;
                }
                case "add": {
                    let newnode = this.unserialize(record.node);
                    if (record.append) {
                        this.idFind(destel, record.append).append(newnode);
                    } else if (record.before) {
                        this.idFind(destel, record.before).before(newnode);
                    } else if (record.after) {
                        this.idFind(destel, record.after).after(newnode);
                    } else {
                        return false;
                    }
                    break;
                }
                default: {
                    console.log(`Unknown history type: ${record.type}`);
                }
            }
        }
    }


    // send changes to server
    historyFetch() {
        if (!this.collaborate) {
            return;
        }
        window.fetch(`/history-get/${this.collaborate_last || 0}`, {
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            method: 'GET',
        }).then(response => {
            if (!response.ok) {
                return Promise.reject();
            }
            return response.json();
        }).then(result => {
            if (!result.length) {
                return false;
            }
            this.observerUnactive();

            let index = this.history.length;
            let updated = false;
            while (index && (this.history[index - 1].id !== this.collaborate_last)) {
                index--;
            }

            for (let residx = 0; residx < result.length; residx++) {
                let record = result[residx];
                this.collaborate_last = record.id;
                if (index < this.history.length && record.id === this.history[index].id) {
                    index++;
                    continue;
                }
                updated = true;

                // we are not synched with the server anymore, rollback and replay
                while (this.history.length > index) {
                    this.historyPop(false);
                }

                if (record.id === 1) {
                    this.dom.innerHTML = '';
                    this.vdom.innerHTML = '';
                }
                this.historyApply(this.dom, record.dom);
                this.historyApply(this.vdom, record.dom);

                // first record is not added in the history
                if (record.id !== 1) {
                    this.history.push(record);
                }
                index++;
            }
            if (updated) {
                this.historyStep();
            }
            this.observerActive();
            this.historyFetch();
        }).catch(err => {
            // If server unreachable or any error trying to fetch it, fault back
            // to non collaborative mode.
            this.collaborate = false;
        });
    }

    historySend(item) {
        if (!this.collaborate) {
            return;
        }
        window.fetch('/history-push', {
            body: JSON.stringify(item),
            headers: {'Content-Type': 'application/json;charset=utf-8'},
            method: 'POST',
        }).then(response => {
            console.log(response);
        });
    }

    historyRollback() {
        this.observerFlush();
        this.historyPop(true);
        this.torollback = false;
        this.unbreaks = new Set();
    }

    historyUndo() {
        this.observerFlush();
        // remove the one in progress before removing the last step
        if (this.history.length > 1) {
            this.historyPop(false);
        }
        this.historyPop(true);
    }
    historyPop(newStep = true) {
        let step = this.history.pop();
        let pos = this.history.length;
        this.history.push({
            cursor: {},
            dom: [],
        });
        // aplly dom changes by reverting history
        while (step.dom.length) {
            let action = step.dom.pop();
            if (!action) {
                break;
            }
            switch (action.type) {
                case "characterData": {
                    this.idFind(this.dom, action.id).textContent = action.oldValue;
                    break;
                }
                case "remove": {
                    let node = this.unserialize(action.node);
                    if (action.nextId && this.idFind(this.dom, action.nextId)) {
                        this.idFind(this.dom, action.nextId).before(node);
                    } else if (action.previousId && this.idFind(this.dom, action.previousId)) {
                        this.idFind(this.dom, action.previousId).after(node);
                    } else {
                        this.idFind(this.dom, action.parentId).append(node);
                    }
                    break;
                }
                case "add": {
                    let el = this.idFind(this.dom, action.id);
                    if (el) {
                        el.remove();
                    }
                }
            }
        }
        // set cursor to latest position
        if (step.cursor.anchorNode) {
            let anchor = this.idFind(this.dom, step.cursor.anchorNode);
            if (anchor) {
                setCursor(anchor, step.cursor.anchorOffset);
            }
        }

        this.observerFlush();
        while (this.history.length > pos) {
            this.history.pop();
        }

        if (newStep) {
            this.history.push({
                cursor: {},
                dom: [],
            });
        }
    }

    /**
     * Same as @see _applyCommand, except that also simulates all the
     * contenteditable behaviors we let happen, e.g. the backspace handling
     * we then rollback.
     *
     * TODO this uses document.execCommand (which is deprecated) and relies on
     * the fact that using a command through it leads to the same result as
     * executing that command through a user keyboard on the unaltered editable
     * section with standard contenteditable attribute. This is already a huge
     * assomption.
     *
     * @param {string} method
     * @returns {?}
     */
    execCommand(method) {
        this._computeHistoryCursor();

        if (method === 'oDeleteBackward') {
            // For backspace command, to execute the same operations as when
            // using the editor, we have to rollback the input after the
            // contentEditable management of the backspace event. For that, we
            // ask for that management through the contentEditable execCommand
            // and let our input event management handle the rest.
            document.execCommand('delete');
            return true;
        }
        return this._applyCommand(...arguments);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    // EDITOR COMMANDS
    // ===============

    /**
     * Applies the given command to the current selection. This does not protect
     * the unbreakables nor update the history cursor nor follow the exact same
     * operations that would be done following events that would lead to that
     * command.
     *
     * To protect the unbreakables, @see _applyCommand
     * For simulation of editor external commands, @see execCommand
     *
     * @private
     * @param {string} method
     * @returns {?}
     */
    _applyRawCommand(method) {
        const sel = document.defaultView.getSelection();
        return sel.anchorNode[method](sel.anchorOffset);
    }
    /**
     * Same as @see _applyRawCommand but protects the unbreakables and updates
     * cursor position before execution with latest computed cursor.
     *
     * @private
     * @param {string} method
     * @returns {?}
     */
    _applyCommand(method) {
        this._recordHistoryCursor(true);
        return this._protectUnbreakable(() => this._applyRawCommand(...arguments));
    }
    /**
     * @private
     * @param {function} callback
     * @returns {?}
     */
    _protectUnbreakable(callback) {
        try {
            return callback.call(this);
        } catch (err) {
            if (err !== UNBREAKABLE_ROLLBACK_CODE) {
                throw err;
            }
        }
        this.historyRollback();
        return UNBREAKABLE_ROLLBACK_CODE;
    }

    // HISTORY
    // =======

    /**
     * @private
     * @returns {Object}
     */
    _computeHistoryCursor() {
        const sel = document.defaultView.getSelection();
        this._latestComputedCursor = {
            anchorNode: sel.anchorNode.oid,
            anchorOffset: sel.anchorOffset,
            focusNode: sel.focusNode.oid,
            focusOffset: sel.focusOffset,
        };
        return this._latestComputedCursor;
    }
    /**
     * @private
     * @param {boolean} [useCache=false]
     */
    _recordHistoryCursor(useCache = false) {
        const latest = this.history[this.history.length - 1];
        latest.cursor = useCache ? this._latestComputedCursor : this._computeHistoryCursor();
    }

    // TOOLBAR
    // =======

    /**
     * @private
     * @param {boolean} [show]
     */
    _updateToolbar(show) {
        if (show !== undefined) {
            this.toolbar.style.visibility = show ? 'visible' : 'hidden';
        }

        let sel = document.defaultView.getSelection();
        this.toolbar.querySelector('#bold').classList.toggle('active', document.queryCommandState("bold"));
        this.toolbar.querySelector('#italic').classList.toggle('active', document.queryCommandState("italic"));
        this.toolbar.querySelector('#underline').classList.toggle('active', document.queryCommandState("underline"));
        this.toolbar.querySelector('#strikeThrough').classList.toggle('active', document.queryCommandState("strikeTrough"));

        let pnode = parentBlock(sel.anchorNode);
        this.toolbar.querySelector('#paragraph').classList.toggle('active', pnode.tagName === 'P');
        this.toolbar.querySelector('#heading1').classList.toggle('active', pnode.tagName === 'H1');
        this.toolbar.querySelector('#heading2').classList.toggle('active', pnode.tagName === 'H2');
        this.toolbar.querySelector('#heading3').classList.toggle('active', pnode.tagName === 'H3');
        this.toolbar.querySelector('#blockquote').classList.toggle('active', pnode.tagName === 'BLOCKQUOTE');
        this.toolbar.querySelector('#unordered').classList.toggle('active', (pnode.tagName === 'LI') && (pnode.parentElement.tagName === "UL"));
        this.toolbar.querySelector('#ordered').classList.toggle('active', (pnode.tagName === 'LI') && (pnode.parentElement.tagName === "OL"));
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * If backspace input, rollback the operation and handle the operation
     * ourself. Needed for mobile, used for desktop for consistency.
     *
     * @private
     */
    _onInput(ev) {
        // Record the cursor position that was computed on keydown or before
        // contentEditable execCommand (whatever preceded the 'input' event)
        this._recordHistoryCursor(true);

        if (ev.inputType === 'deleteContentBackward') {
            this.historyRollback();
            ev.preventDefault();
            this._applyCommand('oDeleteBackward');
        }
    }
    /**
     * @private
     */
    _onKeyDown(ev) {
        console.log(`Keyboard Event ${ev.keyCode}`);

        // Compute the current cursor on keydown but do not record it. Leave
        // that to the command execution or the 'input' event handler.
        this._computeHistoryCursor();

        if (ev.keyCode === 13) { // Enter
            ev.preventDefault();
            if (ev.shiftKey || this._applyCommand('oEnter') === UNBREAKABLE_ROLLBACK_CODE) {
                this._applyCommand('oShiftEnter');
            }
        } else if (ev.keyCode === 9) { // Tab
            if (this._applyCommand(ev.shiftKey ? 'oShiftTab' : 'oTab')) {
                ev.preventDefault();
            }
        } else if (ev.keyCode === 46) { // Delete
            ev.preventDefault();
            // TODO to implement
            this._applyCommand('oDeleteForward');
        } else if (ev.key === 'z' && ev.ctrlKey) { // Ctrl-Z
            ev.preventDefault();
            this.historyUndo();
        } else if (ev.key === 'y' && ev.ctrlKey) { // Ctrl-Y
            ev.preventDefault();
            // TODO to implement
        }

        setTimeout(() => {
            this.sanitize();
            this.historyStep();
        }, 0);
    }
    /**
     * @private
     */
    _onSelectionChange() {
        const sel = document.defaultView.getSelection();
        this._updateToolbar(!sel.isCollapsed);
    }
    /**
     * @private
     */
    _onToolbarClick(ev) {
        const buttonEl = ev.target.closest('div.btn');
        if (!buttonEl) {
            return;
        }

        const TAGS = {
            'paragraph': 'P',
            'heading1': 'H1',
            'heading2': 'H2',
            'heading3': 'H3',
            'blockquote': 'BLOCKQUOTE',
            'ordered': 'OL',
            'unordered': 'UL'
        };
        this._protectUnbreakable(() => {
            if (['bold', 'italic', 'underline', 'strikeThrough'].includes(buttonEl.id)) {
                document.execCommand(buttonEl.id);
            } else if (['ordered', 'unordered'].includes(buttonEl.id)) {
                let sel = document.defaultView.getSelection();
                let pnode = parentBlock(sel.anchorNode);
                if (pnode.tagName !== 'LI') {
                    // TODO: better implementation
                    let main = document.createElement(TAGS[buttonEl.id]);
                    let li = document.createElement('LI');
                    while (pnode.firstChild) {
                        li.append(pnode.firstChild);
                    }
                    main.append(li);
                    pnode.after(main);
                    pnode.remove();
                }
            } else {
                let sel = document.defaultView.getSelection();
                let pnode = parentBlock(sel.anchorNode);
                setTagName(pnode, TAGS[buttonEl.id]);
                setCursor(sel.anchorNode, sel.anchorOffset);
            }
            this._updateToolbar();
        });
        ev.preventDefault();
    }
}

let editor = new OdooEditor(document.getElementById("dom"));
document.getElementById('vdom').append(editor.vdom);
editor.historyFetch();
