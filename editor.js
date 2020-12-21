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
    closestBlock,
    commonParentGet,
    containsUnbreakable,
    nodeSize,
    leftDeepOnlyPath,
    prepareUpdate,
    rightPos,
    setCursor,
    setTagName,
    splitTextNode,
} from "./utils/utils.js";

export const UNBREAKABLE_ROLLBACK_CODE = 100;
export const BACKSPACE_ONLY_COMMANDS = ['oDeleteBackward', 'oDeleteForward'];
export const BACKSPACE_FIRST_COMMANDS = BACKSPACE_ONLY_COMMANDS.concat(['oEnter', 'oShiftEnter']);

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
        this.undos = new Map();
        this.vdom = dom.cloneNode(true);
        this.idSet(dom, this.vdom);

        dom.setAttribute("contentEditable", true);
        this.observerActive();

        this.dom.addEventListener('keydown', this._onKeyDown.bind(this));
        this.dom.addEventListener('input', this._onInput.bind(this));

        document.onselectionchange = this._onSelectionChange.bind(this);

        this.toolbar = document.querySelector('#toolbar');
        this.toolbar.addEventListener('mousedown', this._onToolbarClick.bind(this));

        this.collaborate = false;
        this.collaborate_last = null;

        // used to check if we have to rollback an operation as an unbreakable is
        this.torollback = false; // unbreakable removed or added
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
        this.observerFlush();

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

    // Assign IDs to src, and dest if defined
    idSet(src, dest = undefined) {
        if (!src.oid) {
            src.oid = Math.random() * 2 ** 31 | 0; // TODO: uuid4 or higher number
        }
        if (dest && !dest.oid) {
            dest.oid = src.oid;
        }
        let childsrc = src.firstChild;
        let childdest = dest ? dest.firstChild : undefined;
        while (childsrc) {
            this.idSet(childsrc, childdest);
            childsrc = childsrc.nextSibling;
            childdest = dest ? childdest.nextSibling : undefined;
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
        return this.collaborate ? nodeToObject(node) : node;
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

    observerApply(destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": {
                    this.history[this.history.length - 1].dom.push({
                        'type': "characterData",
                        'id': record.target.oid,
                        "text": record.target.textContent,
                        "oldValue": record.oldValue,
                    });
                    break;
                }
                case "attributes": {
                    this.history[this.history.length - 1].dom.push({
                        'type': "attributes",
                        'id': record.target.oid,
                        "attributeName": record.attributeName,
                        "value": record.target.getAttribute(record.attributeName),
                        "oldValue": record.oldValue,
                    });
                    break;
                }
                case "childList": {
                    record.addedNodes.forEach((added, index) => {
                        this.torollback |= containsUnbreakable(added);
                        // TODO: check that a node does not move from one unBreakable to another
                        // this.torollback |= dest && (inUnbreakable(added).oid != inUnbreakable(dest).oid);
                        let action = {
                            'type': "add",
                        };
                        if (!record.nextSibling && record.target.oid) {
                            action['append'] = record.target.oid;
                        } else if (record.nextSibling.oid) {
                            action['before'] = record.nextSibling.oid;
                        } else if (record.previousSibling.oid) {
                            action['after'] = record.previousSibling.oid;
                        } else {
                            return false;
                        }
                        this.idSet(added);
                        action['id'] = added.oid;
                        action['node'] = this.serialize(added);
                        this.history[this.history.length - 1].dom.push(action);
                    });
                    record.removedNodes.forEach((removed, index) => {
                        this.history[this.history.length - 1].dom.push({
                            'type': "remove",
                            'id': removed.oid,
                            'parentId': record.target.oid,
                            'node': this.serialize(removed),
                            'nextId': record.nextSibling ? record.nextSibling.oid : undefined,
                            'previousId': record.previousSibling ? record.previousSibling.oid : undefined,
                        });
                    });
                    break;
                }
            }
        }
    }

    //
    // History
    //

    // One step completed: apply to vDOM, setup next history step
    historyStep() {
        this.observerFlush();
        // check that not two unBreakables modified
        if (this.torollback) {
            this.historyRollback();
            this.torollback = false;
        }

        // push history
        let latest = this.history[this.history.length - 1];
        if (!latest.dom.length) {
            return false;
        }

        latest.id = Math.random() * 2 ** 31 | 0; // TODO: replace by uuid4 generator
        this.historyApply(this.vdom, latest.dom);
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
            if (record.type === 'characterData') {
                let node = this.idFind(destel, record.id);
                if (node) {
                    node.textContent = record.text;
                }
            } else if (record.type === "attributes") {
                let node = this.idFind(destel, record.id);
                if (node) {
                    node.setAttribute(record.attributeName, record.value);
                }
            } else if (record.type === "remove") {
                let toremove = this.idFind(destel, record.id, record.parentId);
                if (toremove) {
                    toremove.remove();
                }
            } else if (record.type === "add") {
                let newnode = this.unserialize(record.node).cloneNode(1);
                let destnode = this.idFind(destel, record.node.oid);
                if (destnode && (record.node.parentNode.oid === destnode.parentNode.oid)) {
                    // TODO: optimization: remove record from the history to reduce collaboration bandwidth
                    return false;
                }
                this.idSet(record.node, newnode);
                if (record.append) {
                    this.idFind(destel, record.append).append(newnode);
                } else if (record.before) {
                    this.idFind(destel, record.before).before(newnode);
                } else if (record.after) {
                    this.idFind(destel, record.after).after(newnode);
                } else {
                    return false;
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
                    this.historyRollback();
                    this.history.pop();
                }

                if (record.id === 1) {
                    this.dom.innerHTML = '';
                    this.vdom.innerHTML = '';
                }
                this.historyApply(this.dom, record.dom);
                this.historyApply(this.vdom, record.dom);

                record.dom = record.id === 1 ? [] : record.dom;
                this.history.push(record);
                index++;
            }
            if (updated) {
                this.historyStep();
            }
            this.observerActive();
            this.historyFetch();
        }).catch(err => {
            // TODO: change that. currently: if error on fetch, fault back to non collaborative mode.
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

    historyRollback(until = 0) {
        const hist = this.history[this.history.length - 1];
        this.observerFlush();
        this.historyRevert(hist, until);
        this.observerFlush();
        hist.dom = hist.dom.slice(0, until);
        this.torollback = false;
    }

    historyUndo() {
        let pos = this.history.length - 2;
        while (this.undos.has(pos)) {
            pos = this.undos.get(pos) - 1;
        }
        if (pos < 0) {
            return true;
        }
        this.undos.delete(this.history.length - 2);
        this.historyRevert(this.history[pos]);
        this.undos.set(this.history.length - 1, pos);
        this.historyStep();
    }

    historyRedo() {
        this.historyStep();
        let pos = this.history.length - 2;
        if (this.undos.has(pos)) {
            this.historyApply(this.dom, this.history[this.undos.get(pos)].dom);
            let step = this.history[this.undos.get(pos) + 1];
            this.historySetCursor(step);
            this.undos.set(pos + 1, this.undos.get(pos) + 1);
            this.undos.delete(pos);
        }
    }

    historyRevert(step, until = 0) {
        // apply dom changes by reverting history steps
        for (let i = step.dom.length - 1; i >= until; i--) {
            let action = step.dom[i];
            if (!action) {
                break;
            }
            switch (action.type) {
                case "characterData": {
                    this.idFind(this.dom, action.id).textContent = action.oldValue;
                    break;
                }
                case "attributes": {
                    this.idFind(this.dom, action.id).setAttribute(action.attributeName, action.oldValue);
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
        this.historySetCursor(step);
    }

    historySetCursor(step) {
        if (step.cursor.anchorNode) {
            const anchorNode = this.idFind(this.dom, step.cursor.anchorNode);
            const focusNode = step.cursor.focusNode ? this.idFind(this.dom, step.cursor.focusNode) : anchorNode;
            if (anchorNode) {
                setCursor(
                    anchorNode,
                    step.cursor.anchorOffset,
                    focusNode,
                    step.cursor.focusOffset !== undefined ? step.cursor.focusOffset : step.cursor.anchorOffset,
                    false
                );
            }
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

        // For backspace / delete command and execute the same operations as
        // when using the editor, we have to rollback the input after the
        // contentEditable management of the backspace/delete event. For that,
        // we ask for that management through the contentEditable execCommand
        // and let our input event management handle the rest.
        if (method === 'oDeleteBackward') {
            document.execCommand('delete');
            return true;
        } else if (method === 'oDeleteForward') {
            document.execCommand('forwardDelete');
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
     * Applies the given command to the current selection. This does *NOT*:
     * 1) update the history cursor
     * 2) protect the unbreakables
     * 3) sanitize the result
     * 4) create new history entry
     * 5) follow the exact same operations that would be done following events
     *    that would lead to that command
     *
     * For points 1 -> 4, @see _applyCommand
     * For points 1 -> 5, @see execCommand
     *
     * @private
     * @param {string} method
     * @returns {?}
     */
    _applyRawCommand(method) {
        let sel = document.defaultView.getSelection();

        if (!sel.isCollapsed && BACKSPACE_FIRST_COMMANDS.includes(method)) {
            const range = sel.getRangeAt(0);
            let pos1 = [range.startContainer, range.startOffset];
            let pos2 = [range.endContainer, range.endOffset];
            if (!pos2[1]) {
                pos2 = rightPos(leftDeepOnlyPath(...pos2).next().value);
            }

            // Hack: we will follow the logic "do many backspace until the
            // selection is collapsed". The problem is that after one backspace
            // the node the starting position of the cursor is in may have
            // changed (split, removed, moved, etc) so there is no reliable
            // way to know when there has been enough backspaces... except for
            // this hack: we put a fake element acting as a one-space-to-remove
            // element (like an image) at the selection start position and we
            // hit backspace until that element is removed.
            if (pos1[0].nodeType === Node.TEXT_NODE) {
                // First, if the selection start is in a text node, we have to
                // split that text node to be able to put the fake element
                // in-between.
                const splitNode = pos1[0];
                const splitOffset = pos1[1];
                const willActuallySplitPos2 = (pos2[0] === splitNode && splitOffset > 0 && splitOffset < splitNode.length);
                pos1 = [splitNode.parentNode, splitTextNode(splitNode, splitOffset)];
                if (willActuallySplitPos2) {
                    if (pos2[1] < splitOffset) {
                        pos2[0] = splitNode.previousSibling;
                    } else {
                        pos2[1] -= splitOffset;
                    }
                }
            }
            // Then we add the fake element. However to add it properly without
            // risking breaking the DOM states, we still have to prepareUpdate
            // and restore here.
            const restore = prepareUpdate(...pos1);
            const fakeEl = document.createElement('img');
            if (pos1[1] >= pos1[0].childNodes.length) {
                pos1[0].appendChild(fakeEl);
            } else {
                pos1[0].insertBefore(fakeEl, pos1[0].childNodes[pos1[1]]);
            }
            if (pos1[0] === pos2[0] && pos2[1] > pos1[1]) {
                // Update first backspace position offset if it was relative
                // to the same element the fake element has been put in.
                pos2[1]++;
            }
            restore();
            // Check pos2 still make sense as the restoreState may have broken
            // it, if that is is the case, set it just after the fake element.
            if (!pos2[0].parentNode || pos2[1] > nodeSize(pos2[0])) {
                pos2 = rightPos(fakeEl);
            }

            // Starting from the second position, hit backspace until the fake
            // element we added is removed.
            let result;
            let gen;
            do {
                const histPos = this.history[this.history.length - 1].dom.length;
                const err = this._protectUnbreakable(() => {
                    result = pos2[0].oDeleteBackward(pos2[1]);
                    gen = undefined;
                }, histPos);
                if (err === UNBREAKABLE_ROLLBACK_CODE) {
                    gen = gen || leftDeepOnlyPath(...pos2);
                    pos2 = rightPos(gen.next().value);
                    continue;
                }

                sel = document.defaultView.getSelection();
                pos2 = [sel.anchorNode, sel.anchorOffset];
            } while (fakeEl.parentNode);

            if (BACKSPACE_ONLY_COMMANDS.includes(method)) {
                return result;
            }
        }

        return sel.anchorNode[method](sel.anchorOffset);
    }
    /**
     * Same as @see _applyRawCommand but adapt history, protects unbreakables
     * and sanitizes the result.
     *
     * @private
     * @param {string} method
     * @returns {?}
     */
    _applyCommand(method) {
        this._recordHistoryCursor(true);
        const result = this._protectUnbreakable(() => this._applyRawCommand(...arguments));
        this.sanitize();
        this.historyStep();
        return result;
    }
    /**
     * @private
     * @param {function} callback
     * @param {number} [rollbackCounter]
     * @returns {?}
     */
    _protectUnbreakable(callback, rollbackCounter) {
        try {
            let result = callback.call(this);
            this.observerFlush();
            if (!this.torollback) {
                return result;
            }
        } catch (err) {
            if (err !== UNBREAKABLE_ROLLBACK_CODE) {
                throw err;
            }
        }
        this.historyRollback(rollbackCounter);
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
        if (!sel.anchorNode) {
            return this._latestComputedCursor;
        }
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
        let sel = document.defaultView.getSelection();
        if (!sel.anchorNode) {
            show = false;
        }

        if (show !== undefined) {
            this.toolbar.style.visibility = show ? 'visible' : 'hidden';
        }
        if (show === false) {
            return;
        }

        this.toolbar.querySelector('#bold').classList.toggle('active', document.queryCommandState("bold"));
        this.toolbar.querySelector('#italic').classList.toggle('active', document.queryCommandState("italic"));
        this.toolbar.querySelector('#underline').classList.toggle('active', document.queryCommandState("underline"));
        this.toolbar.querySelector('#strikeThrough').classList.toggle('active', document.queryCommandState("strikeTrough"));

        let pnode = closestBlock(sel.anchorNode);
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
     * If backspace/delete input, rollback the operation and handle the
     * operation ourself. Needed for mobile, used for desktop for consistency.
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
        } else if (ev.inputType === 'deleteContentForward') {
            this.historyRollback();
            ev.preventDefault();
            this._applyCommand('oDeleteForward');
        } else {
            this.sanitize();
            this.historyStep();
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
        } else if (ev.key === 'z' && ev.ctrlKey) { // Ctrl-Z
            ev.preventDefault();
            this.historyUndo();
        } else if (ev.key === 'y' && ev.ctrlKey) { // Ctrl-Y
            ev.preventDefault();
            this.historyRedo();
        }
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
            } else if (['fontColor'].includes(buttonEl.id)) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('foreColor', false, "red");
            } else if (['ordered', 'unordered'].includes(buttonEl.id)) {
                let sel = document.defaultView.getSelection();
                let pnode = closestBlock(sel.anchorNode);
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
                let pnode = closestBlock(sel.anchorNode);
                setTagName(pnode, TAGS[buttonEl.id]);
                setCursor(sel.anchorNode, sel.anchorOffset);
            }
            this.historyStep();
            this._updateToolbar();
        });
        ev.preventDefault();
    }
}

let editor = new OdooEditor(document.getElementById("dom"));
document.getElementById('vdom').append(editor.vdom);
editor.historyFetch();
