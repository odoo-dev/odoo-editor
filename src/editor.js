'use strict';

import {} from './commands/deleteBackward.js';
import {} from './commands/deleteForward.js';
import {} from './commands/enter.js';
import {} from './commands/shiftEnter.js';
import {} from './commands/shiftTab.js';
import {} from './commands/tab.js';
import {} from './commands/toggleList.js';
import {} from './commands/align.js';

import { sanitize } from './utils/sanitize.js';
import { nodeToObject, objectToNode } from './utils/serialize.js';
import {
    childNodeIndex,
    closestBlock,
    closestPath,
    commonParentGet,
    containsUnremovable,
    DIRECTIONS,
    getCursorDirection,
    getListMode,
    getCursors,
    getOuid,
    insertText,
    nodeSize,
    leftDeepFirstPath,
    leftDeepOnlyPath,
    prepareUpdate,
    preserveCursor,
    rightPos,
    setCursor,
    setTagName,
    splitTextNode,
    toggleClass,
    findNode,
    closestElement,
    getTraversedNodes,
    isBlock,
    isVisible,
    isContentTextNode,
    latestChild,
    setCursorStart,
    rgbToHex,
    isFontAwesome,
} from './utils/utils.js';

export const UNBREAKABLE_ROLLBACK_CODE = 100;
export const UNREMOVABLE_ROLLBACK_CODE = 110;
export const BACKSPACE_ONLY_COMMANDS = ['oDeleteBackward', 'oDeleteForward'];
export const BACKSPACE_FIRST_COMMANDS = BACKSPACE_ONLY_COMMANDS.concat(['oEnter', 'oShiftEnter']);

const TABLEPICKER_ROW_COUNT = 3;
const TABLEPICKER_COL_COUNT = 3;

export class OdooEditor {
    constructor(dom, options = {}) {
        this.options = options;

        if (typeof this.options.toSanitize === 'undefined') {
            this.options.toSanitize = true;
        }

        this.document = options.document || document;

        dom.oid = 1; // convention: root node is ID 1
        this.dom = this.options.toSanitize ? sanitize(dom) : dom;
        this.resetHistory();
        this.undos = new Map();
        this.redoCount = 0;

        // set contenteditable before clone as FF updates the content at this point
        dom.setAttribute('contenteditable', true);
        this.vdom = dom.cloneNode(true);
        this.vdom.removeAttribute('contenteditable');
        this.idSet(dom, this.vdom);

        this.observerActive();

        this.dom.addEventListener('keydown', this._onKeyDown.bind(this));
        this.dom.addEventListener('input', this._onInput.bind(this));
        this.dom.addEventListener('mousedown', this._onClick.bind(this));
        this.dom.addEventListener('paste', this._onPaste.bind(this));
        this.dom.addEventListener('drop', this._onDrop.bind(this));

        this.document.onselectionchange = this._onSelectionChange.bind(this);

        this._currentMouseState = 'mouseup';
        this.selectionChanged = true;
        this.dom.addEventListener('mousedown', this._updateMouseState.bind(this));
        this.dom.addEventListener('mouseup', this._updateMouseState.bind(this));

        if (this.options.toolbar) {
            this.toolbar = this.options.toolbar;
            this.toolbar.addEventListener('mousedown', this._onToolbarClick.bind(this));
            this.tablePicker = this.toolbar.querySelector('.tablepicker');
            this.tablePickerSizeView = this.toolbar.querySelector('.tablepicker-size');
            this.toolbar
                .querySelector('#tableDropdownButton')
                .addEventListener('click', this._initTablePicker.bind(this));
            for (const colorLabel of this.toolbar.querySelectorAll('label')) {
                colorLabel.addEventListener('mousedown', ev => {
                    // Hack to prevent loss of focus (done by preventDefault) while still opening
                    // color picker dialog (which is also prevented by preventDefault on chrome,
                    // except when click detail is 2, which happens on a double-click but isn't
                    // triggered by a dblclick event)
                    if (ev.detail < 2) {
                        ev.preventDefault();
                        ev.currentTarget.dispatchEvent(new MouseEvent('click', { detail: 2 }));
                    }
                });
                colorLabel.addEventListener('input', ev => {
                    this.document.execCommand(ev.target.name, false, ev.target.value);
                    this._updateColorpickerLabels();
                });
            }
        }

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
    idSet(src, dest = undefined, testunbreak = false) {
        if (!src.oid) {
            src.oid = (Math.random() * 2 ** 31) | 0; // TODO: uuid4 or higher number
        }
        // Rollback if src.ouid changed. This ensures that nodes never change
        // unbreakable ancestors.
        src.ouid = src.ouid || getOuid(src, true);
        if (testunbreak) {
            const ouid = getOuid(src);
            if (!this.torollback && ouid && ouid !== src.ouid) {
                this.torollback = UNBREAKABLE_ROLLBACK_CODE;
            }
        }

        if (dest && !dest.oid) {
            dest.oid = src.oid;
        }
        let childsrc = src.firstChild;
        let childdest = dest ? dest.firstChild : undefined;
        while (childsrc) {
            this.idSet(childsrc, childdest, testunbreak);
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
        if (!this.observer) {
            this.observer = new MutationObserver(records => {
                this.observerApply(this.vdom, records);
            });
        }
        this.observer.observe(this.dom, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            characterDataOldValue: true,
        });
    }

    observerApply(destel, records) {
        for (let record of records) {
            switch (record.type) {
                case 'characterData': {
                    this.history[this.history.length - 1].dom.push({
                        'type': 'characterData',
                        'id': record.target.oid,
                        'text': record.target.textContent,
                        'oldValue': record.oldValue,
                    });
                    break;
                }
                case 'attributes': {
                    this.history[this.history.length - 1].dom.push({
                        'type': 'attributes',
                        'id': record.target.oid,
                        'attributeName': record.attributeName,
                        'value': record.target.getAttribute(record.attributeName),
                        'oldValue': record.oldValue,
                    });
                    break;
                }
                case 'childList': {
                    record.addedNodes.forEach((added, index) => {
                        this.torollback =
                            this.torollback ||
                            (containsUnremovable(added) && UNREMOVABLE_ROLLBACK_CODE);
                        let action = {
                            'type': 'add',
                        };
                        if (!record.nextSibling && record.target.oid) {
                            action.append = record.target.oid;
                        } else if (record.nextSibling.oid) {
                            action.before = record.nextSibling.oid;
                        } else if (record.previousSibling.oid) {
                            action.after = record.previousSibling.oid;
                        } else {
                            return false;
                        }
                        this.idSet(added, undefined, true);
                        action.id = added.oid;
                        action.node = this.serialize(added);
                        this.history[this.history.length - 1].dom.push(action);
                    });
                    record.removedNodes.forEach((removed, index) => {
                        // Tables can be safely removed even though their
                        // contents are unremovable.
                        if (
                            !this.torollback &&
                            removed.tagName !== 'TABLE' &&
                            containsUnremovable(removed)
                        ) {
                            this.torollback = UNREMOVABLE_ROLLBACK_CODE;
                        }
                        this.history[this.history.length - 1].dom.push({
                            'type': 'remove',
                            'id': removed.oid,
                            'parentId': record.target.oid,
                            'node': this.serialize(removed),
                            'nextId': record.nextSibling ? record.nextSibling.oid : undefined,
                            'previousId': record.previousSibling
                                ? record.previousSibling.oid
                                : undefined,
                        });
                    });
                    break;
                }
            }
        }
    }

    resetHistory() {
        this.history = [
            {
                cursor: {
                    // cursor at beginning of step
                    anchorNode: undefined,
                    anchorOffset: undefined,
                    focusNode: undefined,
                    focusOffset: undefined,
                },
                dom: [],
                id: undefined,
            },
        ];
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

        latest.id = (Math.random() * 2 ** 31) | 0; // TODO: replace by uuid4 generator
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
            } else if (record.type === 'attributes') {
                let node = this.idFind(destel, record.id);
                if (node) {
                    node.setAttribute(record.attributeName, record.value);
                }
            } else if (record.type === 'remove') {
                let toremove = this.idFind(destel, record.id, record.parentId);
                if (toremove) {
                    toremove.remove();
                }
            } else if (record.type === 'add') {
                let node = this.unserialize(record.node);
                let newnode = node.cloneNode(1);
                // preserve oid after the clone
                this.idSet(node, newnode);

                let destnode = this.idFind(destel, record.node.oid);
                if (destnode && record.node.parentNode.oid === destnode.parentNode.oid) {
                    // TODO: optimization: remove record from the history to reduce collaboration bandwidth
                    continue;
                }
                if (record.append && this.idFind(destel, record.append)) {
                    this.idFind(destel, record.append).append(newnode);
                } else if (record.before && this.idFind(destel, record.before)) {
                    this.idFind(destel, record.before).before(newnode);
                } else if (record.after && this.idFind(destel, record.after)) {
                    this.idFind(destel, record.after).after(newnode);
                } else {
                    continue;
                }
            }
        }
    }

    // send changes to server
    historyFetch() {
        if (!this.collaborate) {
            return;
        }
        window
            .fetch(`/history-get/${this.collaborate_last || 0}`, {
                headers: { 'Content-Type': 'application/json;charset=utf-8' },
                method: 'GET',
            })
            .then(response => {
                if (!response.ok) {
                    return Promise.reject();
                }
                return response.json();
            })
            .then(result => {
                if (!result.length) {
                    return false;
                }
                this.observerUnactive();

                let index = this.history.length;
                let updated = false;
                while (index && this.history[index - 1].id !== this.collaborate_last) {
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
                    this.history.push({
                        cursor: {},
                        dom: [],
                    });
                }
                this.observerActive();
                this.historyFetch();
            })
            .catch(err => {
                // TODO: change that. currently: if error on fetch, fault back to non collaborative mode.
                this.collaborate = false;
            });
    }

    historySend(item) {
        if (!this.collaborate) {
            return;
        }
        window
            .fetch('/history-push', {
                body: JSON.stringify(item),
                headers: { 'Content-Type': 'application/json;charset=utf-8' },
                method: 'POST',
            })
            .then(response => {
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
        this.redoCount = this.undos.has(pos) ? this.redoCount : 0;
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
        const pos = this.history.length - 2;
        const undoRedoPairs = (pos - this.undos.get(pos)) / 2;
        if (this.undos.has(pos) && this.redoCount < undoRedoPairs) {
            this.redoCount++;
            this.historyApply(this.dom, this.history[this.undos.get(pos)].dom);
            const step = this.history[this.undos.get(pos) + 1];
            this.historySetCursor(step);
            this.undos.set(pos + 1, this.undos.get(pos) + 1);
            this.undos.delete(pos);
            this.historyStep();
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
                case 'characterData': {
                    this.idFind(this.dom, action.id).textContent = action.oldValue;
                    break;
                }
                case 'attributes': {
                    this.idFind(this.dom, action.id).setAttribute(
                        action.attributeName,
                        action.oldValue,
                    );
                    break;
                }
                case 'remove': {
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
                case 'add': {
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
            const focusNode = step.cursor.focusNode
                ? this.idFind(this.dom, step.cursor.focusNode)
                : anchorNode;
            if (anchorNode) {
                setCursor(
                    anchorNode,
                    step.cursor.anchorOffset,
                    focusNode,
                    step.cursor.focusOffset !== undefined
                        ? step.cursor.focusOffset
                        : step.cursor.anchorOffset,
                    false,
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
        return this._applyCommand(...arguments);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    // EDITOR COMMANDS
    // ===============

    deleteRange(sel) {
        const range = sel.getRangeAt(0);
        const isSelForward =
            sel.anchorNode === range.startContainer && sel.anchorOffset === range.startOffset;
        let pos1 = [range.startContainer, range.startOffset];
        let pos2 = [range.endContainer, range.endOffset];
        // A selection spanning multiple nodes and ending at position 0 of a
        // node, like the one resulting from a triple click, are corrected so
        // that it ends at the last position of the previous node instead.
        if (!pos2[1]) {
            pos2 = rightPos(leftDeepOnlyPath(...pos2).next().value);
            const previousElement = leftDeepOnlyPath(...pos2).next().value;
            pos2[0] = latestChild(previousElement);
            pos2[1] = nodeSize(pos2[0]);
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
            const willActuallySplitPos2 =
                pos2[0] === splitNode && splitOffset > 0 && splitOffset < splitNode.length;
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
        const fakeEl = this.document.createElement('img');
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

        // If there's a fully selected table, remove it.
        let traversedNodes = getTraversedNodes(this.document);
        for (const table of traversedNodes.filter(node => node.nodeName === 'TABLE')) {
            const tableDescendantElements = [...table.querySelectorAll('*')];
            if (tableDescendantElements.every(child => traversedNodes.includes(child))) {
                table.remove();
                traversedNodes = getTraversedNodes(this.document);
            }
        }

        // Starting from the second position, hit backspace until the fake
        // element we added is removed.
        let gen;
        do {
            const histPos = this.history[this.history.length - 1].dom.length;
            const err = this._protect(() => {
                pos2[0].oDeleteBackward(pos2[1]);
                gen = undefined;
            }, histPos);
            if (err === UNREMOVABLE_ROLLBACK_CODE || err === UNBREAKABLE_ROLLBACK_CODE) {
                gen = gen || leftDeepOnlyPath(...pos2);
                pos2 = rightPos(gen.next().value);
            } else {
                this._recordHistoryCursor();
                sel = this.document.defaultView.getSelection();
                pos2 = isSelForward
                    ? [sel.anchorNode, sel.anchorOffset]
                    : [sel.focusNode, sel.focusOffset];
            }
        } while (fakeEl.parentNode);
    }

    _insertFontAwesome(faClass = 'fa fa-star') {
        const sel = this.document.defaultView.getSelection();
        if (!sel.isCollapsed) {
            this.deleteRange(sel);
        }
        // We need to add a &#8203; to ensure the insertHTML command is not ignored
        if (document.execCommand('insertHTML', false, '<i class="' + faClass + '">&#8203;</i>')) {
            const node = closestElement(sel.focusNode, 'i');
            let pos = [node.parentElement, childNodeIndex(node) + 1];
            setCursor(...pos, ...pos, false);
        }
    }

    _createLink(link, content) {
        const sel = this.document.defaultView.getSelection();
        if (content && !sel.isCollapsed) {
            this.deleteRange(sel);
        }
        if (sel.isCollapsed) {
            insertText(sel, content || 'link');
        }
        const currentLink = closestElement(sel.focusNode, 'a');
        link = link || prompt('URL or Email', (currentLink && currentLink.href) || 'http://');
        const res = this.document.execCommand('createLink', false, link);
        if (res) {
            setCursor(sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset);
            const node = findNode(closestPath(sel.focusNode), node => node.tagName === 'A');
            let pos = [node.parentElement, childNodeIndex(node) + 1];
            setCursor(...pos, ...pos, false);
        }
    }

    _unLink(offset, content) {
        const sel = this.document.defaultView.getSelection();
        if (sel.isCollapsed) {
            const cr = preserveCursor(this.document);
            const node = closestElement(sel.focusNode, 'a');
            setCursor(node, 0, node, node.childNodes.length, false);
            this.document.execCommand('unlink');
            cr();
        } else {
            this.document.execCommand('unlink');
            setCursor(sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset);
        }
    }

    _indentList(mode = 'indent') {
        let [pos1, pos2] = getCursors(this.document);
        let end = leftDeepFirstPath(...pos1).next().value;
        let li = new Set();
        for (let node of leftDeepFirstPath(...pos2)) {
            let cli = closestBlock(node);
            if (cli?.tagName == 'LI' && !li.has(cli) && !cli.classList.contains('nested')) {
                li.add(cli);
            }
            if (node == end) break;
        }
        for (let node of li) {
            if (mode == 'indent') {
                node.oTab(0);
            } else {
                node.oShiftTab(0);
            }
        }
        return true;
    }

    _toggleList(mode) {
        let sel = this.document.defaultView.getSelection();
        let end = leftDeepFirstPath(sel.anchorNode, sel.anchorOffset).next().value;

        let li = new Set();
        let blocks = new Set();

        for (let node of leftDeepFirstPath(sel.focusNode, sel.focusOffset)) {
            let block = closestBlock(node);
            if (!['OL', 'UL'].includes(block.tagName)) {
                let ublock = block.closest('ol, ul');
                ublock && getListMode(ublock) == mode ? li.add(block) : blocks.add(block);
            }
            if (node == end) break;
        }

        let target = [...(blocks.size ? blocks : li)];
        while (target.length) {
            let node = target.pop();
            // only apply one li per ul
            if (!node.oToggleList(0, mode)) {
                target = target.filter(
                    li => li.parentNode != node.parentNode || li.tagName != 'LI',
                );
            }
        }
    }

    _align(mode) {
        const sel = this.document.defaultView.getSelection();
        const visitedBlocks = new Set();
        const traversedNode = getTraversedNodes(this.document);
        for (const node of traversedNode) {
            if (isContentTextNode(node) && isVisible(node)) {
                let block = closestBlock(node);
                if (!visitedBlocks.has(block)) {
                    const hasModifier = getComputedStyle(block).textAlign === mode;
                    if (!hasModifier && block.isContentEditable) {
                        block.oAlign(sel.anchorOffset, mode);
                    }
                    visitedBlocks.add(block);
                }
            }
        }
    }
    /**
     * @param {string} size A valid css size string
     */
    _setFontSize(size) {
        this._applyInlineStyle(element => {
            element.style.fontSize = size;
        });
    }

    /**
     * This function abstracts the difficulty of applying a inline style to a
     * selection. TODO: This implementations potentially adds one span per text
     * node, in an ideal world it would wrap all concerned nodes in one span
     * whenever possible.
     * @param {Element => void} applyStyle Callback that receives an element to
     * which the wanted style should be applied
     */
    _applyInlineStyle(applyStyle) {
        const sel = this.document.defaultView.getSelection();
        const { startContainer, startOffset, endContainer, endOffset } = sel.getRangeAt(0);
        const { anchorNode, anchorOffset, focusNode, focusOffset } = sel;
        const direction = getCursorDirection(anchorNode, anchorOffset, focusNode, focusOffset);
        const selectedTextNodes = getTraversedNodes(this.document).filter(node =>
            isContentTextNode(node),
        );
        for (const textNode of selectedTextNodes) {
            const atLeastOneCharFromNodeInSelection = !(
                (textNode === endContainer && endOffset === 0) ||
                (textNode === startContainer && endOffset === textNode.textContent.length)
            );
            // If text node ends after the end of the selection, split it and
            // keep the part that is inside.
            if (endContainer === textNode && endOffset < textNode.textContent.length) {
                // No reassignement needed, entirely dependent on the
                // splitTextNode implementation.
                splitTextNode(textNode, endOffset, DIRECTIONS.LEFT);
            }
            // If text node starts before the beginning of the selection, split it
            // and keep the part that is inside as textNode.
            if (startContainer === textNode && startOffset > 0) {
                // No reassignement needed, entirely dependent on the
                // splitTextNode implementation.
                splitTextNode(textNode, startOffset, DIRECTIONS.RIGHT);
            }
            // If the parent is not inline or is not completely in the
            // selection, wrap text node in inline node. Also skips <a> tags to
            // work with native `removeFormat` command
            if (
                atLeastOneCharFromNodeInSelection &&
                (isBlock(textNode.parentElement) ||
                    (textNode === endContainer && textNode.nextSibling) ||
                    (textNode === startContainer && textNode.previousSibling) ||
                    textNode.parentElement.tagName === 'A')
            ) {
                const newParent = document.createElement('span');
                textNode.after(newParent);
                newParent.appendChild(textNode);
            }
            // Make sure there's at least one char selected in the text node
            if (atLeastOneCharFromNodeInSelection) {
                applyStyle(textNode.parentElement);
            }
        }
        if (direction === DIRECTIONS.RIGHT) {
            setCursor(startContainer, 0, endContainer, endOffset);
        } else {
            setCursor(endContainer, endOffset, startContainer, 0);
        }
    }

    /**
     * Applies the given command to the current selection. This does *NOT*:
     * 1) update the history cursor
     * 2) protect the unbreakables or unremovables
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
    _applyRawCommand(method, ...args) {
        let sel = this.document.defaultView.getSelection();
        if (!sel.isCollapsed && BACKSPACE_FIRST_COMMANDS.includes(method)) {
            this.deleteRange(sel);
            if (BACKSPACE_ONLY_COMMANDS.includes(method)) {
                return true;
            }
        }
        if (['toggleList', 'createLink', 'unLink', 'indentList', 'setFontSize'].includes(method)) {
            return this['_' + method](...args);
        }
        if (method.startsWith('justify')) {
            const mode = method.split('justify').join('').toLocaleLowerCase();
            return this._align(mode === 'full' ? 'justify' : mode);
        }
        return sel.anchorNode[method](sel.anchorOffset, ...args);
    }

    /**
     * Same as @see _applyRawCommand but adapt history, protects unbreakables
     * and removables and sanitizes the result.
     *
     * @private
     * @param {string} method
     * @returns {?}
     */
    _applyCommand(method) {
        this._recordHistoryCursor(true);
        const result = this._protect(() => this._applyRawCommand(...arguments));
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
    _protect(callback, rollbackCounter) {
        try {
            let result = callback.call(this);
            this.observerFlush();
            if (this.torollback) {
                const torollbackCode = this.torollback;
                this.historyRollback(rollbackCounter);
                return torollbackCode; // UNBREAKABLE_ROLLBACK_CODE || UNREMOVABLE_ROLLBACK_CODE
            } else {
                return result;
            }
        } catch (error) {
            if (error === UNBREAKABLE_ROLLBACK_CODE || error === UNREMOVABLE_ROLLBACK_CODE) {
                this.historyRollback(rollbackCounter);
                return error;
            } else {
                throw error;
            }
        }
    }

    // HISTORY
    // =======

    /**
     * @private
     * @returns {Object}
     */
    _computeHistoryCursor() {
        const sel = this.document.defaultView.getSelection();
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
        if (!this.options.toolbar) return;

        let sel = this.document.defaultView.getSelection();
        if (!sel.anchorNode) {
            show = false;
        }
        if (show !== undefined && this.options.autohideToolbar) {
            this.toolbar.style.visibility = show ? 'visible' : 'hidden';
        }
        if (show === false) {
            return;
        }
        const paragraphDropdownButton = this.toolbar.querySelector('#paragraphDropdownButton');
        for (let commandState of [
            'bold',
            'italic',
            'underline',
            'strikeThrough',
            'justifyLeft',
            'justifyRight',
            'justifyCenter',
            'justifyFull',
        ]) {
            const isStateTrue = this.document.queryCommandState(commandState);
            this.toolbar.querySelector('#' + commandState).classList.toggle('active', isStateTrue);
            if (commandState.startsWith('justify')) {
                const direction = commandState.replace('justify', '').toLowerCase();
                const newClass = `fa-align-${direction === 'full' ? 'justify' : direction}`;
                paragraphDropdownButton.classList.toggle(newClass, isStateTrue);
            }
        }
        const closestsStartContainer = closestElement(sel.getRangeAt(0).startContainer, '*');
        const selectionStartStyle = getComputedStyle(closestsStartContainer);
        this.toolbar.querySelector('#fontSizeCurrentValue').innerHTML = /\d+/
            .exec(selectionStartStyle.fontSize)
            .pop();
        this._updateColorpickerLabels();
        let pnode = closestBlock(sel.anchorNode);
        this.toolbar.querySelector('#paragraph').classList.toggle('active', pnode.tagName === 'P');
        this.toolbar.querySelector('#heading1').classList.toggle('active', pnode.tagName === 'H1');
        this.toolbar.querySelector('#heading2').classList.toggle('active', pnode.tagName === 'H2');
        this.toolbar.querySelector('#heading3').classList.toggle('active', pnode.tagName === 'H3');
        this.toolbar
            .querySelector('#blockquote')
            .classList.toggle('active', pnode.tagName === 'BLOCKQUOTE');
        this.toolbar
            .querySelector('#unordered')
            .classList.toggle(
                'active',
                pnode.tagName === 'LI' && getListMode(pnode.parentElement) === 'UL',
            );
        this.toolbar
            .querySelector('#ordered')
            .classList.toggle(
                'active',
                pnode.tagName === 'LI' && getListMode(pnode.parentElement) === 'OL',
            );
        this.toolbar
            .querySelector('#checklist')
            .classList.toggle(
                'active',
                pnode.tagName === 'LI' && getListMode(pnode.parentElement) === 'CL',
            );
        const linkNode = closestElement(sel.focusNode, 'a');
        this.toolbar.querySelector('#createLink').classList.toggle('active', linkNode);
        this.toolbar.querySelector('#unLink').classList.toggle('active', linkNode);
        this._positionToolbar();
    }
    _updateColorpickerLabels() {
        const foreColor = rgbToHex(document.queryCommandValue('foreColor'));
        this.toolbar.style.setProperty('--fore-color', foreColor);
        this.toolbar.querySelector('#foreColor input').value = foreColor;

        const sel = this.document.defaultView.getSelection();
        const startContainer = sel.getRangeAt(0).startContainer;
        const closestBgColor =
            closestElement(startContainer, '[style*="background-color"]') ||
            closestElement(startContainer);
        const hiliteColor = rgbToHex(getComputedStyle(closestBgColor).backgroundColor).slice(0, 7);
        this.toolbar.style.setProperty('--hilite-color', hiliteColor);
        this.toolbar.querySelector('#hiliteColor input').value = hiliteColor;
    }
    _positionToolbar() {
        const OFFSET = 10;
        let isBottom = false;
        this.toolbar.classList.toggle('toolbar-bottom', false);
        this.toolbar.style.maxWidth = this.dom.offsetWidth - OFFSET * 2 + 'px';
        const sel = this.document.defaultView.getSelection();
        const range = sel.getRangeAt(0);
        const isSelForward =
            sel.anchorNode === range.startContainer && sel.anchorOffset === range.startOffset;
        const selRect = range.getBoundingClientRect();
        const toolbarWidth = this.toolbar.offsetWidth;
        const toolbarHeight = this.toolbar.offsetHeight;
        const editorRect = this.dom.getBoundingClientRect();
        const editorLeftPos = Math.max(0, editorRect.left);
        const editorTopPos = Math.max(0, editorRect.top);
        const scrollX = this.document.defaultView.window.scrollX;
        const scrollY = this.document.defaultView.window.scrollY;

        // Get left position.
        let left = selRect.left + OFFSET;
        // Ensure the toolbar doesn't overflow the editor on the left.
        left = Math.max(editorLeftPos + OFFSET, left);
        // Ensure the toolbar doesn't overflow the editor on the right.
        left = Math.min(editorLeftPos + this.dom.offsetWidth - OFFSET - toolbarWidth, left);
        this.toolbar.style.left = scrollX + left + 'px';

        // Get top position.
        let top = selRect.top - toolbarHeight - OFFSET;
        // Ensure the toolbar doesn't overflow the editor on the top.
        if (top < editorTopPos) {
            // Position the toolbar below the selection.
            top = selRect.bottom + OFFSET;
            isBottom = true;
        }
        // Ensure the toolbar doesn't overflow the editor on the bottom.
        top = Math.min(editorTopPos + this.dom.offsetHeight - OFFSET - toolbarHeight, top);
        this.toolbar.style.top = scrollY + top + 'px';

        // Position the arrow.
        let arrowLeftPos = (isSelForward ? selRect.right : selRect.left) - left - OFFSET;
        // Ensure the arrow doesn't overflow the toolbar on the left.
        arrowLeftPos = Math.max(OFFSET, arrowLeftPos);
        // Ensure the arrow doesn't overflow the toolbar on the right.
        arrowLeftPos = Math.min(toolbarWidth - OFFSET - 20, arrowLeftPos);
        this.toolbar.style.setProperty('--arrow-left-pos', arrowLeftPos + 'px');
        if (isBottom) {
            this.toolbar.classList.toggle('toolbar-bottom', true);
            this.toolbar.style.setProperty('--arrow-top-pos', -17 + 'px');
        } else {
            this.toolbar.style.setProperty('--arrow-top-pos', toolbarHeight - 3 + 'px');
        }
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
            const sel = this.document.defaultView.getSelection();
            const { startContainer, startOffset } = sel.getRangeAt(0);
            this.historyRollback();
            const { endContainer, endOffset } = sel.getRangeAt(0);
            sel.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
            ev.preventDefault();
            this._applyCommand('oDeleteBackward');
        } else if (ev.inputType === 'deleteContentForward') {
            this.historyRollback();
            ev.preventDefault();
            this._applyCommand('oDeleteForward');
        } else if (['insertText', 'insertCompositionText'].includes(ev.inputType)) {
            // insertCompositionText, courtesy of Samsung keyboard.
            const hist = this.history[this.history.length - 1];
            // Start rollback process.
            this.observerFlush();
            const { anchorNode, focusNode, anchorOffset, focusOffset } = this.history[
                this.history.length - 1
            ].cursor;
            const selection = this.document.defaultView.getSelection();
            // Detect that text was selected and change behavior only if it is the case,
            // since it is the only text insertion case that may cause problems.
            if (anchorNode !== focusNode || anchorOffset !== focusOffset) {
                // Do the rest of the rollback process.
                this.historyRollback();
                this.historyRevert(hist, 0);
                this.observerFlush();
                hist.dom = hist.dom.slice(0, 0);
                this.torollback = false;
                ev.preventDefault();
                this._applyCommand('oDeleteBackward');
                insertText(selection, ev.data);
                const range = selection.getRangeAt(0);
                setCursor(range.endContainer, range.endOffset);
            }
            this.sanitize();
            this.historyStep();
        } else {
            this.sanitize();
            this.historyStep();
        }
    }

    /**
     * @private
     */
    _onKeyDown(ev) {
        // Compute the current cursor on keydown but do not record it. Leave
        // that to the command execution or the 'input' event handler.
        this._computeHistoryCursor();
        // If the pressed key has a printed representation, the returned value
        // is a non-empty Unicode character string containing the printable
        // representation of the key. In this case, call `deleteRange` before
        // inserting the printed representation of the character.
        if (!ev.ctrlKey && /^.$/u.test(ev.key)) {
            const selection = this.document.defaultView.getSelection();
            if (selection && !selection.isCollapsed) {
                this.deleteRange(selection);
            }
        }
        if (ev.keyCode === 13) {
            // Enter
            ev.preventDefault();
            if (ev.shiftKey || this._applyCommand('oEnter') === UNBREAKABLE_ROLLBACK_CODE) {
                this._applyCommand('oShiftEnter');
            }
        } else if (ev.keyCode === 9) {
            // Tab
            if (this._applyCommand('indentList', ev.shiftKey ? 'outdent' : 'indent')) {
                ev.preventDefault();
            }
        } else if (ev.key === 'z' && ev.ctrlKey) {
            // Ctrl-Z
            ev.preventDefault();
            this.historyUndo();
        } else if (ev.key === 'y' && ev.ctrlKey) {
            // Ctrl-Y
            ev.preventDefault();
            this.historyRedo();
        }
    }
    /**
     * @private
     */
    _onSelectionChange() {
        const sel = this.document.defaultView.getSelection();
        this._updateToolbar(!sel.isCollapsed);
        if (this._currentMouseState === 'mousedown') {
            // _fixFontAwesomeSelection will be called when the mouseUp event is triggered
            this.selectionChanged = true;
        } else {
            this._fixFontAwesomeSelection();
        }
    }

    _updateMouseState(ev) {
        this._currentMouseState = ev.type;
        if (ev.type === 'mouseup' && this.selectionChanged) {
            this._fixFontAwesomeSelection();
        }
    }

    _onClick(ev) {
        let node = ev.target;
        // handle checkbox lists
        if (node.tagName == 'LI' && getListMode(node.parentElement) == 'CL') {
            if (ev.offsetX < 0) {
                node.classList.remove('unchecked');
                toggleClass(node, 'checked');
                ev.preventDefault();
            }
        }
    }

    /**
     * Prevent the pasting of HTML and paste text only instead.
     */
    _onPaste(ev) {
        ev.preventDefault();
        const pastedText = (ev.originalEvent || ev).clipboardData.getData('text/plain');
        const sel = this.document.defaultView.getSelection();
        if (!sel.isCollapsed) {
            this.deleteRange(sel);
        }
        if (sel.anchorOffset === 0 && childNodeIndex(sel.anchorNode) === 0) {
            // Prevent text directly in div contenteditable and other weird
            // manipulations by execCommand.
            const p = this.document.createElement('p');
            p.appendChild(document.createElement('br'));
            const block = closestBlock(sel.anchorNode);
            block.parentElement.insertBefore(p, block);
            setCursorStart(p);
        }
        this.document.execCommand('insertHTML', false, pastedText.replace(/\n+/g, '<br/>'));
    }

    /**
     * Prevent the dropping of HTML and paste text only instead.
     */
    _onDrop(ev) {
        ev.preventDefault();
        const sel = this.document.defaultView.getSelection();
        let isInEditor = false;
        let ancestor = sel.anchorNode;
        while (ancestor && !isInEditor) {
            if (ancestor === this.dom) {
                isInEditor = true;
            }
            ancestor = ancestor.parentNode;
        }
        const transferItem = [...(ev.originalEvent || ev).dataTransfer.items].find(
            item => item.type === 'text/plain',
        );
        if (transferItem) {
            transferItem.getAsString(pastedText => {
                if (isInEditor && !sel.isCollapsed) {
                    this.deleteRange(sel);
                }
                if (document.caretPositionFromPoint) {
                    const range = this.document.caretPositionFromPoint(ev.clientX, ev.clientY);
                    setCursor(range.offsetNode, range.offset);
                } else if (document.caretRangeFromPoint) {
                    const range = this.document.caretRangeFromPoint(ev.clientX, ev.clientY);
                    setCursor(range.startContainer, range.startOffset);
                }
                if (sel.anchorOffset === 0 && childNodeIndex(sel.anchorNode) === 0) {
                    // Prevent text directly in div contenteditable and other weird
                    // manipulations by execCommand.
                    const p = this.document.createElement('p');
                    p.appendChild(document.createElement('br'));
                    const block = closestBlock(sel.anchorNode);
                    block.parentElement.insertBefore(p, block);
                    setCursorStart(p);
                }
                this.document.execCommand('insertHTML', false, pastedText.replace(/\n+/g, '<br/>'));
            });
        }
    }

    _onToolbarClick(ev) {
        const buttonEl = ev.target.closest('div.btn,a.dropdown-item');
        if (!buttonEl) {
            return;
        }

        const TAGS = {
            'paragraph': 'P',
            'pre': 'PRE',
            'heading1': 'H1',
            'heading2': 'H2',
            'heading3': 'H3',
            'heading4': 'H4',
            'heading5': 'H5',
            'heading6': 'H6',
            'blockquote': 'BLOCKQUOTE',
            'ordered': 'OL',
            'unordered': 'UL',
            'checklist': 'CL',
        };
        ev.preventDefault();
        this._protect(() => {
            if (buttonEl.classList.contains('tablepicker-cell')) {
                const table = this.document.createElement('table');
                const tbody = this.document.createElement('tbody');
                table.appendChild(tbody);
                const rowId = +buttonEl.dataset.rowId;
                const colId = +buttonEl.dataset.colId;
                for (let rowIndex = 0; rowIndex < rowId; rowIndex++) {
                    const tr = this.document.createElement('tr');
                    tbody.appendChild(tr);
                    for (let colIndex = 0; colIndex < colId; colIndex++) {
                        const td = this.document.createElement('td');
                        const br = this.document.createElement('br');
                        td.appendChild(br);
                        tr.appendChild(td);
                    }
                }
                const sel = this.document.defaultView.getSelection();
                if (!sel.isCollapsed) {
                    this.deleteRange(sel);
                }
                sel.focusNode.parentNode.insertBefore(table, sel.focusNode);
                setCursorStart(table.querySelector('td'));
            } else if (
                ['bold', 'italic', 'underline', 'strikeThrough', 'removeFormat'].includes(
                    buttonEl.id,
                )
            ) {
                this.document.execCommand(buttonEl.id);
            } else if (['foreColor', 'hiliteColor'].includes(buttonEl.id)) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand(buttonEl.id, false, 'red');
            } else if (buttonEl.dataset.fontSize) {
                this.execCommand('setFontSize', buttonEl.dataset.fontSize);
            } else if (['createLink', 'unLink'].includes(buttonEl.id)) {
                this.execCommand(buttonEl.id);
            } else if (['ordered', 'unordered', 'checklist'].includes(buttonEl.id)) {
                this.execCommand('toggleList', TAGS[buttonEl.id]);
            } else if (buttonEl.id.startsWith('justify')) {
                this.execCommand(buttonEl.id);
            } else if (buttonEl.id.startsWith('fontawesome')) {
                this._insertFontAwesome();
            } else {
                const restoreCursor = preserveCursor(this.document);
                const selectedBlocks = [
                    ...new Set(getTraversedNodes(this.document).map(closestBlock)),
                ];
                for (const selectedBlock of selectedBlocks) {
                    const block = closestBlock(selectedBlock);
                    if (
                        ['P', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(
                            block.nodeName,
                        )
                    ) {
                        setTagName(block, TAGS[buttonEl.id]);
                    } else {
                        // eg do not change a <div> into a h1: insert the h1
                        // into it instead.
                        const newBlock = this.document.createElement(TAGS[buttonEl.id]);
                        const children = [...block.childNodes];
                        block.insertBefore(newBlock, block.firstChild);
                        children.forEach(child => newBlock.appendChild(child));
                    }
                }
                restoreCursor();
            }
            this.historyStep();
            this._updateToolbar();
        });
    }
    _initTablePicker() {
        for (const child of [...this.tablePicker.childNodes]) {
            child.remove();
        }
        this.tablePicker.dataset.rowCount = 0;
        this.tablePicker.dataset.colCount = 0;
        for (let rowIndex = 0; rowIndex < TABLEPICKER_ROW_COUNT; rowIndex++) {
            this._addTablePickerRow();
        }
        for (let colIndex = 0; colIndex < TABLEPICKER_COL_COUNT; colIndex++) {
            this._addTablePickerColumn();
        }
        this.tablePicker.querySelector('.tablepicker-cell').classList.toggle('active', true);
        this.tablePickerSizeView.textContent = '1x1';
    }
    _addTablePickerRow() {
        const row = this.document.createElement('div');
        row.classList.add('tablepicker-row');
        row.dataset.rowId = this.tablePicker.querySelectorAll('.tablepicker-row').length + 1;
        this.tablePicker.appendChild(row);
        this.tablePicker.dataset.rowCount = +this.tablePicker.dataset.rowCount + 1;
        for (let i = 0; i < +this.tablePicker.dataset.colCount; i++) {
            this._addTablePickerCell(row);
        }
        return row;
    }
    _addTablePickerColumn() {
        for (const row of this.tablePicker.querySelectorAll('.tablepicker-row')) {
            this._addTablePickerCell(row);
        }
        this.tablePicker.dataset.colCount = +this.tablePicker.dataset.colCount + 1;
    }
    _addTablePickerCell(row) {
        const rowId = +row.dataset.rowId;
        const colId = row.querySelectorAll('.tablepicker-cell').length + 1;
        const cell = this.document.createElement('div');
        cell.classList.add('tablepicker-cell', 'btn');
        cell.dataset.rowId = rowId;
        cell.dataset.colId = colId;
        row.appendChild(cell);
        cell.addEventListener('mouseover', () => this._onHoverTablePickerCell(rowId, colId));
    }
    _onHoverTablePickerCell(targetRowId, targetColId) {
        // Hightlight the active cells, remove highlight of the others.
        for (const cell of this.tablePicker.querySelectorAll('.tablepicker-cell')) {
            const [rowId, colId] = [+cell.dataset.rowId, +cell.dataset.colId];
            const isActive = rowId <= targetRowId && colId <= targetColId;
            cell.classList.toggle('active', isActive);
        }
        this.tablePickerSizeView.textContent = `${targetColId}x${targetRowId}`;

        // Add/remove rows to expand/shrink the tablepicker.
        if (targetRowId >= +this.tablePicker.dataset.rowCount) {
            this._addTablePickerRow();
        } else if (+this.tablePicker.dataset.rowCount > TABLEPICKER_ROW_COUNT) {
            for (const row of this.tablePicker.querySelectorAll('.tablepicker-row')) {
                const rowId = +row.dataset.rowId;
                if (rowId >= TABLEPICKER_ROW_COUNT && rowId > targetRowId + 1) {
                    row.remove();
                    this.tablePicker.dataset.rowCount = +this.tablePicker.dataset.rowCount - 1;
                }
            }
        }
        // Add/remove cols to expand/shrink the tablepicker.
        const colCount = +this.tablePicker.dataset.colCount;
        if (targetColId >= colCount) {
            this._addTablePickerColumn();
        } else if (colCount > TABLEPICKER_COL_COUNT) {
            const removedColIds = new Set();
            for (const cell of this.tablePicker.querySelectorAll('.tablepicker-cell')) {
                const colId = +cell.dataset.colId;
                if (colId >= TABLEPICKER_COL_COUNT && colId > targetColId + 1) {
                    cell.remove();
                    removedColIds.add(colId);
                }
            }
            this.tablePicker.dataset.colCount = colCount - removedColIds.size;
        }
    }

    /**
     * Fix the current selection range in case the range start or end inside a fontAwesome node
     */
    _fixFontAwesomeSelection() {
        const selection = this.document.defaultView.getSelection();
        if (selection.isCollapsed) return;
        let shouldUpdateSelection = false;
        const fixedSelection = {
            anchorNode: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focusNode: selection.focusNode,
            focusOffset: selection.focusOffset,
        };
        const selectionDirection = getCursorDirection(
            selection.anchorNode,
            selection.anchorOffset,
            selection.focusNode,
            selection.focusOffset,
        );
        // check and fix anchor node
        const closestAnchorNodeEl = closestElement(selection.anchorNode);
        if (isFontAwesome(closestAnchorNodeEl)) {
            shouldUpdateSelection = true;
            fixedSelection.anchorNode =
                selectionDirection === DIRECTIONS.RIGHT
                    ? closestAnchorNodeEl.previousSibling
                    : closestAnchorNodeEl.nextSibling;
            fixedSelection.anchorOffset =
                selectionDirection === DIRECTIONS.RIGHT ? fixedSelection.anchorNode.length : 0;
        }
        // check and fix focus node
        const closestFocusNodeEl = closestElement(selection.focusNode);
        if (isFontAwesome(closestFocusNodeEl)) {
            shouldUpdateSelection = true;
            fixedSelection.focusNode =
                selectionDirection === DIRECTIONS.RIGHT
                    ? closestFocusNodeEl.nextSibling
                    : closestFocusNodeEl.previousSibling;
            fixedSelection.focusOffset =
                selectionDirection === DIRECTIONS.RIGHT ? 0 : fixedSelection.focusNode.length;
        }
        if (shouldUpdateSelection) {
            setCursor(
                fixedSelection.anchorNode,
                fixedSelection.anchorOffset,
                fixedSelection.focusNode,
                fixedSelection.focusOffset,
                false,
            );
        }
    }
}
