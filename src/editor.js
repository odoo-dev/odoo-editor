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
    closestBlock,
    commonParentGet,
    containsUnremovable,
    DIRECTIONS,
    endPos,
    getCursorDirection,
    getListMode,
    getOuid,
    insertText,
    nodeSize,
    preserveCursor,
    setCursor,
    startPos,
    toggleClass,
    closestElement,
    isVisible,
    rgbToHex,
    isFontAwesome,
    getInSelection,
    getDeepRange,
    ancestors,
    firstLeaf,
    nextLeaf,
    isUnremovable,
    fillEmpty,
} from './utils/utils.js';
import { editorCommands } from './commands.js';
import { CommandBar } from './commandbar.js';
import { TablePicker } from './tablepicker.js';

export * from './utils/utils.js';
export const UNBREAKABLE_ROLLBACK_CODE = 'UNBREAKABLE';
export const UNREMOVABLE_ROLLBACK_CODE = 'UNREMOVABLE';
export const BACKSPACE_ONLY_COMMANDS = ['oDeleteBackward', 'oDeleteForward'];
export const BACKSPACE_FIRST_COMMANDS = BACKSPACE_ONLY_COMMANDS.concat(['oEnter', 'oShiftEnter']);

const KEYBOARD_TYPES = { VIRTUAL: 'VIRTUAL', PHYSICAL: 'PHYSICAL', UNKNOWN: 'UKNOWN' };

const isUndo = ev => ev.key === 'z' && (ev.ctrlKey || ev.metaKey);
const isRedo = ev => ev.key === 'y' && (ev.ctrlKey || ev.metaKey);

function defaultOptions(defaultObject, object) {
    const newObject = Object.assign({}, defaultObject, object);
    for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'undefined') {
            newObject[key] = defaultObject[key];
        }
    }
    return newObject;
}

export class OdooEditor extends EventTarget {
    constructor(editable, options = {}) {
        super();

        this.options = defaultOptions(
            {
                controlHistoryFromDocument: false,
                toSanitize: true,
                isRootEditable: true,
                getContentEditableAreas: () => [],
                _t: string => string,
            },
            options,
        );

        // --------------
        // Set properties
        // --------------

        this.document = options.document || document;

        this.isMobile = matchMedia('(max-width: 767px)').matches;

        // Keyboard type detection, happens only at the first keydown event.
        this.keyboardType = KEYBOARD_TYPES.UNKNOWN;

        // Wether we should check for unbreakable the next history step.
        this._checkStepUnbreakable = true;

        // All dom listeners currently active.
        this._domListeners = [];

        this.resetHistory();

        // Set of labels that which prevent the automatic step mechanism if
        // it contains at least one element.
        this._observerTimeoutUnactive = new Set();
        // Set of labels that which prevent the observer to be active if
        // it contains at least one element.
        this._observerUnactiveLabels = new Set();

        // The state of the dom.
        this._currentMouseState = 'mouseup';

        this._onKeyupResetContenteditableNodes = [];

        this._isCollaborativeActive = false;
        this._collaborativeLastSynchronisedId = null;

        // Track if we need to rollback mutations in case unbreakable or unremovable are being added or removed.
        this._toRollback = false;

        // Map that from an node id to the dom node.
        this._idToNodeMap = new Map();

        // -------------------
        // Alter the editable
        // -------------------

        if (editable.innerHTML.trim() === '') {
            editable.innerHTML = '<p><br></p>';
        }

        // Convention: root node is ID 1.
        editable.oid = 1;
        this._idToNodeMap.set(1, editable);
        this.editable = this.options.toSanitize ? sanitize(editable) : editable;

        // Set contenteditable before clone as FF updates the content at this point.
        this._activateContenteditable();

        this.idSet(editable);

        this._createCommandBar();

        this.toolbarTablePicker = new TablePicker({ document: this.document });
        this.toolbarTablePicker.addEventListener('cell-selected', ev => {
            this.execCommand('insertTable', {
                rowNumber: ev.detail.rowNumber,
                colNumber: ev.detail.colNumber,
            });
        });

        // -----------
        // Bind events
        // -----------

        this.observerActive();

        this.addDomListener(this.editable, 'keydown', this._onKeyDown);
        this.addDomListener(this.editable, 'input', this._onInput);
        this.addDomListener(this.editable, 'mousedown', this._onMouseDown);
        this.addDomListener(this.editable, 'mouseup', this._onMouseup);
        this.addDomListener(this.editable, 'paste', this._onPaste);
        this.addDomListener(this.editable, 'drop', this._onDrop);

        this.addDomListener(this.document, 'selectionchange', this._onSelectionChange);
        this.addDomListener(this.document, 'keydown', this._onDocumentKeydown);
        this.addDomListener(this.document, 'keyup', this._onDocumentKeyup);

        // -------
        // Toolbar
        // -------

        if (this.options.toolbar) {
            this.toolbar = this.options.toolbar;
            this._bindToolbar();
            // Ensure anchors in the toolbar don't trigger a hash change.
            const toolbarAnchors = this.toolbar.querySelectorAll('a');
            toolbarAnchors.forEach(a => a.addEventListener('click', e => e.preventDefault()));
            const tablepickerDropdown = this.toolbar.querySelector('.oe-tablepicker-dropdown');
            tablepickerDropdown && tablepickerDropdown.append(this.toolbarTablePicker.el);
            this.toolbarTablePicker.show();
            const tableDropdownButton = this.toolbar.querySelector('#tableDropdownButton');
            tableDropdownButton &&
                tableDropdownButton.addEventListener('click', () => {
                    this.toolbarTablePicker.reset();
                });
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
                    this.updateColorpickerLabels();
                });
            }
            if (this.isMobile) {
                this.editable.before(this.toolbar);
            }
        }
    }
    /**
     * Releases anything that was initialized.
     *
     * TODO: properly implement this.
     */
    destroy() {
        this.observerUnactive();
        this._removeDomListener();
        this.commandBar.destroy();
        this.commandbarTablePicker.el.remove();
    }

    sanitize() {
        this.observerFlush();

        // find common ancestror in this.history[-1]
        const step = this._historySteps[this._historySteps.length - 1];
        let commonAncestor, record;
        for (record of step.mutations) {
            const node = this.idFind(record.parentId || record.id) || this.editable;
            commonAncestor = commonAncestor
                ? commonParentGet(commonAncestor, node, this.editable)
                : node;
        }
        if (!commonAncestor) {
            return false;
        }

        // sanitize and mark current position as sanitized
        sanitize(commonAncestor);
    }

    addDomListener(element, eventName, callback) {
        const boundCallback = callback.bind(this);
        this._domListeners.push([element, eventName, boundCallback]);
        element.addEventListener(eventName, boundCallback);
    }

    // Assign IDs to src, and dest if defined
    idSet(node, testunbreak = false) {
        if (!node.oid) {
            node.oid = (Math.random() * 2 ** 31) | 0; // TODO: uuid4 or higher number
            this._idToNodeMap.set(node.oid, node);
        }
        // Rollback if node.ouid changed. This ensures that nodes never change
        // unbreakable ancestors.
        node.ouid = node.ouid || getOuid(node, true);
        if (testunbreak) {
            const ouid = getOuid(node);
            if (!this._toRollback && ouid && ouid !== node.ouid) {
                this._toRollback = UNBREAKABLE_ROLLBACK_CODE;
            }
        }

        let childNode = node.firstChild;
        while (childNode) {
            this.idSet(childNode, testunbreak);
            childNode = childNode.nextSibling;
        }
    }

    idFind(id) {
        return this._idToNodeMap.get(id);
    }

    // Observer that syncs doms

    // if not in collaboration mode, no need to serialize / unserialize
    serialize(node) {
        return this._isCollaborativeActive ? nodeToObject(node) : node;
    }
    unserialize(obj) {
        return this._isCollaborativeActive ? objectToNode(obj) : obj;
    }

    automaticStepActive(label) {
        this._observerTimeoutUnactive.delete(label);
    }
    automaticStepUnactive(label) {
        this._observerTimeoutUnactive.add(label);
    }
    automaticStepSkipStack() {
        this.automaticStepUnactive('skipStack');
        setTimeout(() => this.automaticStepActive('skipStack'));
    }
    observerUnactive(label) {
        this._observerUnactiveLabels.add(label);
        clearTimeout(this.observerTimeout);
        this.observer.disconnect();
        this.observerFlush();
    }
    observerFlush() {
        this.observerApply(this.observer.takeRecords());
    }
    observerActive(label) {
        this._observerUnactiveLabels.delete(label);
        if (this._observerUnactiveLabels.size !== 0) return;

        if (!this.observer) {
            this.observer = new MutationObserver(records => {
                records = this.filterMutationRecords(records);
                if (!records.length) return;
                clearTimeout(this.observerTimeout);
                if (this._observerTimeoutUnactive.size === 0) {
                    this.observerTimeout = setTimeout(() => {
                        this.historyStep();
                    }, 100);
                }
                this.observerApply(records);
            });
        }
        this.observer.observe(this.editable, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: true,
            characterData: true,
            characterDataOldValue: true,
        });
    }

    observerApply(records) {
        for (const record of records) {
            switch (record.type) {
                case 'characterData': {
                    this._historySteps[this._historySteps.length - 1].mutations.push({
                        'type': 'characterData',
                        'id': record.target.oid,
                        'text': record.target.textContent,
                        'oldValue': record.oldValue,
                    });
                    break;
                }
                case 'attributes': {
                    this._historySteps[this._historySteps.length - 1].mutations.push({
                        'type': 'attributes',
                        'id': record.target.oid,
                        'attributeName': record.attributeName,
                        'value': record.target.getAttribute(record.attributeName),
                        'oldValue': record.oldValue,
                    });
                    break;
                }
                case 'childList': {
                    record.addedNodes.forEach(added => {
                        this._toRollback =
                            this._toRollback ||
                            (containsUnremovable(added) && UNREMOVABLE_ROLLBACK_CODE);
                        const mutation = {
                            'type': 'add',
                        };
                        if (!record.nextSibling && record.target.oid) {
                            mutation.append = record.target.oid;
                        } else if (record.nextSibling && record.nextSibling.oid) {
                            mutation.before = record.nextSibling.oid;
                        } else if (!record.previousSibling && record.target.oid) {
                            mutation.prepend = record.target.oid;
                        } else if (record.previousSibling && record.previousSibling.oid) {
                            mutation.after = record.previousSibling.oid;
                        } else {
                            return false;
                        }
                        this.idSet(added, this._checkStepUnbreakable);
                        mutation.id = added.oid;
                        mutation.node = this.serialize(added);
                        this._historySteps[this._historySteps.length - 1].mutations.push(mutation);
                    });
                    record.removedNodes.forEach(removed => {
                        if (!this._toRollback && containsUnremovable(removed)) {
                            this._toRollback = UNREMOVABLE_ROLLBACK_CODE;
                        }
                        this._historySteps[this._historySteps.length - 1].mutations.push({
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
        this.dispatchEvent(new Event('observerApply'));
    }
    filterMutationRecords(records) {
        // Save the first attribute in a cache to compare only the first
        // attribute record of node to its latest state.
        const attributeCache = new Map();
        const filteredRecords = [];

        for (const record of records) {
            if (record.type === 'attributes') {
                // Skip the attributes change on the dom.
                if (record.target === this.editable) continue;

                attributeCache.set(record.target, attributeCache.get(record.target) || {});
                if (
                    typeof attributeCache.get(record.target)[record.attributeName] === 'undefined'
                ) {
                    const oldValue = record.oldValue === undefined ? null : record.oldValue;
                    attributeCache.get(record.target)[record.attributeName] =
                        oldValue !== record.target.getAttribute(record.attributeName);
                }
                if (!attributeCache.get(record.target)[record.attributeName]) {
                    continue;
                }
            }
            filteredRecords.push(record);
        }
        return filteredRecords;
    }

    resetHistory() {
        this._historySteps = [
            {
                cursor: {
                    // cursor at beginning of step
                    anchorNode: undefined,
                    anchorOffset: undefined,
                    focusNode: undefined,
                    focusOffset: undefined,
                },
                mutations: [],
                id: undefined,
            },
        ];
        this._historyStepsStates = new Map();
    }
    //
    // History
    //

    // One step completed: apply to vDOM, setup next history step
    historyStep(skipRollback = false) {
        this.observerFlush();
        // check that not two unBreakables modified
        if (this._toRollback) {
            if (!skipRollback) this.historyRollback();
            this._toRollback = false;
        }

        // push history
        const latest = this._historySteps[this._historySteps.length - 1];
        if (!latest.mutations.length) {
            return false;
        }

        latest.id = (Math.random() * 2 ** 31) | 0; // TODO: replace by uuid4 generator
        this.historySend(latest);
        this._historySteps.push({
            cursor: {},
            mutations: [],
        });
        this._checkStepUnbreakable = true;
        this._recordHistoryCursor();
        this.dispatchEvent(new Event('historyStep'));
    }

    // apply changes according to some records
    historyApply(records) {
        for (const record of records) {
            if (record.type === 'characterData') {
                const node = this.idFind(record.id);
                if (node) {
                    node.textContent = record.text;
                }
            } else if (record.type === 'attributes') {
                const node = this.idFind(record.id);
                if (node) {
                    node.setAttribute(record.attributeName, record.value);
                }
            } else if (record.type === 'remove') {
                const toremove = this.idFind(record.id);
                if (toremove) {
                    toremove.remove();
                }
            } else if (record.type === 'add') {
                const node = this.unserialize(record.node);
                const newnode = node.cloneNode(1);
                // preserve oid after the clone
                this.idSet(node, newnode);

                const destnode = this.idFind(record.node.oid);
                if (destnode && record.node.parentNode.oid === destnode.parentNode.oid) {
                    // TODO: optimization: remove record from the history to reduce collaboration bandwidth
                    continue;
                }
                if (record.append && this.idFind(record.append)) {
                    this.idFind(record.append).append(newnode);
                } else if (record.before && this.idFind(record.before)) {
                    this.idFind(record.before).before(newnode);
                } else if (record.after && this.idFind(record.after)) {
                    this.idFind(record.after).after(newnode);
                } else {
                    continue;
                }
            }
        }
    }

    // send changes to server
    historyFetch() {
        if (!this._isCollaborativeActive) {
            return;
        }
        window
            .fetch(`/history-get/${this._collaborativeLastSynchronisedId || 0}`, {
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

                let index = this._historySteps.length;
                let updated = false;
                while (
                    index &&
                    this._historySteps[index - 1].id !== this._collaborativeLastSynchronisedId
                ) {
                    index--;
                }

                for (let residx = 0; residx < result.length; residx++) {
                    const record = result[residx];
                    this._collaborativeLastSynchronisedId = record.id;
                    if (
                        index < this._historySteps.length &&
                        record.id === this._historySteps[index].id
                    ) {
                        index++;
                        continue;
                    }
                    updated = true;

                    // we are not synched with the server anymore, rollback and replay
                    while (this._historySteps.length > index) {
                        this.historyRollback();
                        this._historySteps.pop();
                    }

                    if (record.id === 1) {
                        this.editable.innerHTML = '';
                    }
                    this.historyApply(record.mutations);

                    record.mutations = record.id === 1 ? [] : record.mutations;
                    this._historySteps.push(record);
                    index++;
                }
                if (updated) {
                    this._historySteps.push({
                        cursor: {},
                        mutations: [],
                    });
                }
                this.observerActive();
                this.historyFetch();
            })
            .catch(() => {
                // TODO: change that. currently: if error on fetch, fault back to non collaborative mode.
                this._isCollaborativeActive = false;
            });
    }

    historySend(item) {
        if (!this._isCollaborativeActive) {
            return;
        }
        window.fetch('/history-push', {
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'application/json;charset=utf-8' },
            method: 'POST',
        });
    }

    historyRollback(until = 0) {
        const step = this._historySteps[this._historySteps.length - 1];
        this.observerFlush();
        this.historyRevert(step, until);
        this.observerFlush();
        step.mutations = step.mutations.slice(0, until);
        this._toRollback = false;
    }

    /**
     * Undo a step of the history.
     *
     * this._historyStepsState is a map from it's location (index) in this.history to a state.
     * The state can be on of:
     * undefined: the position has never been undo or redo.
     * 0: The position is considered as a redo of another.
     * 1: The position is considered as a undo of another.
     * 2: The position has been undone and is considered consumed.
     */
    historyUndo() {
        // The last step is considered an uncommited draft so always revert it.
        const lastStep = this._historySteps[this._historySteps.length - 1];
        this.historyRevert(lastStep);
        // Clean the last step otherwise if no other step is created after, the
        // mutations of the revert itself will be added to the same step and
        // grow exponentially at each undo.
        lastStep.mutations = [];

        const pos = this._getNextUndoIndex();
        if (pos >= 0) {
            // Consider the position consumed.
            this._historyStepsStates.set(pos, 2);
            this.historyRevert(this._historySteps[pos]);
            // Consider the last position of the history as an undo.
            this._historyStepsStates.set(this._historySteps.length - 1, 1);
            this.historyStep(true);
            this.dispatchEvent(new Event('historyUndo'));
        }
    }

    /**
     * Redo a step of the history.
     *
     * @see historyUndo
     */
    historyRedo() {
        const pos = this._getNextRedoIndex();
        if (pos >= 0) {
            this._historyStepsStates.set(pos, 2);
            this.historyRevert(this._historySteps[pos]);
            this._historyStepsStates.set(this._historySteps.length - 1, 0);
            this.historySetCursor(this._historySteps[pos]);
            this.historyStep(true);
            this.dispatchEvent(new Event('historyRedo'));
        }
    }
    /**
     * Check wether undoing is possible.
     */
    historyCanUndo() {
        return this._getNextUndoIndex() >= 0;
    }
    /**
     * Check wether redoing is possible.
     */
    historyCanRedo() {
        return this._getNextRedoIndex() >= 0;
    }
    historySize() {
        return this._historySteps.length;
    }

    historyRevert(step, until = 0) {
        // apply dom changes by reverting history steps
        for (let i = step.mutations.length - 1; i >= until; i--) {
            const mutation = step.mutations[i];
            if (!mutation) {
                break;
            }
            switch (mutation.type) {
                case 'characterData': {
                    const node = this.idFind(mutation.id);
                    if (node) node.textContent = mutation.oldValue;
                    break;
                }
                case 'attributes': {
                    const node = this.idFind(mutation.id);
                    if (node) {
                        if (mutation.oldValue) {
                            node.setAttribute(mutation.attributeName, mutation.oldValue);
                        } else {
                            node.removeAttribute(mutation.attributeName);
                        }
                    }
                    break;
                }
                case 'remove': {
                    const nodeToRemove = this.unserialize(mutation.node);
                    if (mutation.nextId && this.idFind(mutation.nextId)) {
                        const node = this.idFind(mutation.nextId);
                        node && node.before(nodeToRemove);
                    } else if (mutation.previousId && this.idFind(mutation.previousId)) {
                        const node = this.idFind(mutation.previousId);
                        node && node.after(nodeToRemove);
                    } else {
                        const node = this.idFind(mutation.parentId);
                        node && node.append(nodeToRemove);
                    }
                    break;
                }
                case 'add': {
                    const node = this.idFind(mutation.id);
                    if (node) {
                        node.remove();
                    }
                }
            }
        }
        this._activateContenteditable();
        this.historySetCursor(step);
        this.dispatchEvent(new Event('historyRevert'));
    }

    /**
     * Place the cursor on the last known cursor position from the history steps.
     *
     * @returns {boolean}
     */
    resetCursorOnLastHistoryCursor() {
        const lastHistoryStep = this._historySteps[this._historySteps.length - 1];
        if (lastHistoryStep && lastHistoryStep.cursor && lastHistoryStep.cursor.anchorNode) {
            this.historySetCursor(lastHistoryStep);
            return true;
        }
        return false;
    }

    historySetCursor(step) {
        if (step.cursor && step.cursor.anchorNode) {
            const anchorNode = this.idFind(step.cursor.anchorNode);
            const focusNode = step.cursor.focusNode
                ? this.idFind(step.cursor.focusNode)
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
    unbreakableStepUnactive() {
        this._toRollback =
            this._toRollback === UNBREAKABLE_ROLLBACK_CODE ? false : this._toRollback;
        this._checkStepUnbreakable = false;
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
    execCommand(...args) {
        this._computeHistoryCursor();
        return this._applyCommand(...args);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _removeDomListener() {
        for (const [element, eventName, boundCallback] of this._domListeners) {
            element.removeEventListener(eventName, boundCallback);
        }
        this._domListeners = [];
    }

    // EDITOR COMMANDS
    // ===============

    deleteRange(sel) {
        let range = getDeepRange(this.editable, {
            sel,
            splitText: true,
            select: true,
            correctTripleClick: true,
        });
        if (!range) return;
        let start = range.startContainer;
        let end = range.endContainer;
        // Let the DOM split and delete the range.
        const doJoin = closestBlock(start) !== closestBlock(range.commonAncestorContainer);
        let next = nextLeaf(end, this.editable);
        const splitEndTd = closestElement(end, 'td') && end.nextSibling;
        const contents = range.extractContents();
        setCursor(start, nodeSize(start));
        range = getDeepRange(this.editable, { sel });
        // Restore unremovables removed by extractContents.
        [...contents.querySelectorAll('*')].filter(isUnremovable).forEach(n => {
            closestBlock(range.endContainer).after(n);
            n.textContent = '';
        });
        // Restore table contents removed by extractContents.
        const tds = [...contents.querySelectorAll('td')].filter(n => !closestElement(n, 'table'));
        let currentFragmentTr, currentTr;
        const currentTd = closestElement(range.endContainer, 'td');
        tds.forEach((td, i) => {
            const parentFragmentTr = closestElement(td, 'tr');
            // Skip the first and the last partially selected TD.
            if (i && !(splitEndTd && i === tds.length - 1)) {
                if (parentFragmentTr !== currentFragmentTr) {
                    currentTr = currentTr
                        ? currentTr.nextElementSibling
                        : closestElement(range.endContainer, 'tr').nextElementSibling;
                }
                currentTr ? currentTr.prepend(td) : currentTd.after(td);
            }
            currentFragmentTr = parentFragmentTr;
            td.textContent = '';
        });
        this.observerFlush();
        this._toRollback = false; // Errors caught with observerFlush were already handled.
        // If the end container was fully selected, extractContents may have
        // emptied it without removing it. Ensure it's gone.
        const isRemovableInvisible = (node, noBlocks = true) =>
            !isVisible(node, noBlocks) && !isUnremovable(node) && node.nodeName !== 'A';
        const endIsStart = end === start;
        while (end && isRemovableInvisible(end, false) && !end.contains(range.endContainer)) {
            const parent = end.parentNode;
            end.remove();
            end = parent;
        }
        // Same with the start container
        while (
            start &&
            isRemovableInvisible(start) &&
            !(endIsStart && start.contains(range.startContainer))
        ) {
            const parent = start.parentNode;
            start.remove();
            start = parent;
        }
        // Ensure empty blocks be given a <br> child.
        if (start) {
            fillEmpty(closestBlock(start));
        }
        fillEmpty(closestBlock(range.endContainer));
        // Ensure trailing space remains visible.
        const joinWith = range.endContainer;
        const oldText = joinWith.textContent;
        if (joinWith && oldText.endsWith(' ')) {
            joinWith.textContent = oldText.replace(/ $/, '\u00A0');
            setCursor(joinWith, nodeSize(joinWith));
        }
        // Rejoin blocks that extractContents may have split in two.
        while (
            doJoin &&
            next &&
            !(next.previousSibling && next.previousSibling === joinWith) &&
            this.editable.contains(next)
        ) {
            const restore = preserveCursor(this.document);
            this.observerFlush();
            const res = this._protect(() => {
                next.oDeleteBackward();
                if (!this.editable.contains(joinWith)) {
                    this._toRollback = UNREMOVABLE_ROLLBACK_CODE; // tried to delete too far -> roll it back.
                } else {
                    next = firstLeaf(next);
                }
            }, this._historySteps[this._historySteps.length - 1].mutations.length);
            if ([UNBREAKABLE_ROLLBACK_CODE, UNREMOVABLE_ROLLBACK_CODE].includes(res)) {
                restore();
                break;
            }
        }
        next = joinWith && joinWith.nextSibling;
        if (
            joinWith &&
            oldText.endsWith(' ') &&
            !(next && next.nodeType === Node.TEXT_NODE && next.textContent.startsWith(' '))
        ) {
            // Restore the text we modified in order to preserve trailing space.
            joinWith.textContent = oldText;
            setCursor(joinWith, nodeSize(joinWith));
        }
    }

    updateColorpickerLabels(params = {}) {
        const foreColor = params.foreColor || rgbToHex(document.queryCommandValue('foreColor'));
        this.toolbar.style.setProperty('--fore-color', foreColor);
        const foreColorInput = this.toolbar.querySelector('#foreColor input');
        if (foreColorInput) {
            foreColorInput.value = foreColor;
        }

        let hiliteColor = params.hiliteColor;
        if (!hiliteColor) {
            const sel = this.document.defaultView.getSelection();
            if (sel.rangeCount) {
                const endContainer = closestElement(sel.getRangeAt(0).endContainer);
                const hiliteColorRgb = getComputedStyle(endContainer).backgroundColor;
                hiliteColor = rgbToHex(hiliteColorRgb);
            }
        }
        this.toolbar.style.setProperty('--hilite-color', hiliteColor);
        const hiliteColorInput = this.toolbar.querySelector('#hiliteColor input');
        if (hiliteColorInput) {
            hiliteColorInput.value = hiliteColor.length <= 7 ? hiliteColor : rgbToHex(hiliteColor);
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
        const sel = this.document.defaultView.getSelection();
        if (!sel.isCollapsed && BACKSPACE_FIRST_COMMANDS.includes(method)) {
            this.deleteRange(sel);
            if (BACKSPACE_ONLY_COMMANDS.includes(method)) {
                return true;
            }
        }
        if (editorCommands[method]) {
            return editorCommands[method](this, ...args);
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
    _applyCommand(...args) {
        this._recordHistoryCursor(true);
        const result = this._protect(() => this._applyRawCommand(...args));
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
            const result = callback.call(this);
            this.observerFlush();
            if (this._toRollback) {
                const torollbackCode = this._toRollback;
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

    _activateContenteditable() {
        this.editable.setAttribute('contenteditable', this.options.isRootEditable);

        for (const node of this.options.getContentEditableAreas()) {
            if (!node.isContentEditable) {
                node.setAttribute('contenteditable', true);
            }
        }
    }
    _stopContenteditable() {
        if (this.options.isRootEditable) {
            this.editable.setAttribute('contenteditable', !this.options.isRootEditable);
        }
        for (const node of this.options.getContentEditableAreas()) {
            if (node.getAttribute('contenteditable') === 'true') {
                node.setAttribute('contenteditable', false);
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
        const latest = this._historySteps[this._historySteps.length - 1];
        latest.cursor =
            (useCache ? this._latestComputedCursor : this._computeHistoryCursor()) || {};
    }
    /**
     * Get the step index in the history to undo.
     * Return -1 if no undo index can be found.
     */
    _getNextUndoIndex() {
        let index = this._historySteps.length - 2;
        // go back to first step that can be undoed (0 or undefined)
        while (this._historyStepsStates.get(index)) {
            index--;
        }
        return index;
    }
    /**
     * Get the step index in the history to redo.
     * Return -1 if no redo index can be found.
     */
    _getNextRedoIndex() {
        let pos = this._historySteps.length - 2;
        // We cannot redo more than what is consumed.
        // Check if we have no more 2 than 0 until we get to a 1
        let totalConsumed = 0;
        while (this._historyStepsStates.has(pos) && this._historyStepsStates.get(pos) !== 1) {
            // here ._historyStepsState.get(pos) can only be 2 (consumed) or 0 (undoed).
            totalConsumed += this._historyStepsStates.get(pos) === 2 ? 1 : -1;
            pos--;
        }
        const canRedo = this._historyStepsStates.get(pos) === 1 && totalConsumed <= 0;
        return canRedo ? pos : -1;
    }

    // COMMAND BAR
    // ===========

    _createCommandBar() {
        this.options.noScrollSelector = this.options.noScrollSelector || 'body';

        const revertHistoryBeforeCommandbar = () => {
            let stepIndex = this._historySteps.length - 1;
            while (stepIndex >= this._beforeCommandbarStepIndex) {
                const stepState = this._historyStepsStates.get(stepIndex);
                if (stepState !== 2) {
                    this.historyRevert(this._historySteps[stepIndex]);
                }
                this._historyStepsStates.set(stepIndex, 2);
                stepIndex--;
            }
            this._historyStepsStates.set(this._historySteps.length - 1, 1);
            this.historyStep(true);
            setTimeout(() => {
                this.editable.focus();
                getDeepRange(this.editable, { select: true });
            });
        };

        this.commandbarTablePicker = new TablePicker({
            document: this.document,
            floating: true,
        });

        document.body.appendChild(this.commandbarTablePicker.el);

        this.commandbarTablePicker.addEventListener('cell-selected', ev => {
            this.execCommand('insertTable', {
                rowNumber: ev.detail.rowNumber,
                colNumber: ev.detail.colNumber,
            });
        });

        const mainCommands = [
            {
                groupName: 'Basic blocks',
                title: 'Heading 1',
                description: 'Big section heading.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('setTag', 'H1');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Heading 2',
                description: 'Medium section heading.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('setTag', 'H2');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Heading 3',
                description: 'Small section heading.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('setTag', 'H3');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Text',
                description: 'Paragraph block.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('setTag', 'P');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Bulleted list',
                description: 'Create a simple bulleted list.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('toggleList', 'UL');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Numbered list',
                description: 'Create a list with numbering.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('toggleList', 'OL');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Check list',
                description: 'Track tasks with a check list.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('toggleList', 'CL');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Horizontal rule',
                description: 'Insert an horizantal rule.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.execCommand('insertHorizontalRule');
                },
            },
            {
                groupName: 'Basic blocks',
                title: 'Table',
                description: 'Insert a table.',
                imageSrc: 'https://www.notion.so/images/blocks/text.9fdb530b.png',
                callback: () => {
                    this.commandbarTablePicker.show();
                },
            },
        ];
        // Translate the command title and description if a translate function
        // is provided.
        for (const command of mainCommands) {
            command.title = this.options._t(command.title);
            command.description = this.options._t(command.description);
        }
        this.commandBar = new CommandBar({
            editable: this.editable,
            _t: this.options._t,
            onShow: () => {
                this.commandbarTablePicker.hide();
            },
            onActivate: () => {
                this._beforeCommandbarStepIndex = this._historySteps.length - 1;
                this.observerUnactive();
                for (const element of document.querySelectorAll(this.options.noScrollSelector)) {
                    element.classList.add('oe-noscroll');
                }
                this.observerActive();
            },
            preValidate: () => {
                revertHistoryBeforeCommandbar();
            },
            postValidate: () => {
                this.historyStep(true);
            },
            onStop: () => {
                this.observerUnactive();
                for (const element of document.querySelectorAll('.oe-noscroll')) {
                    element.classList.remove('oe-noscroll');
                }
                this.observerActive();
            },
            commands: [...mainCommands, ...(this.options.commands || [])],
        });
    }

    // TOOLBAR
    // =======

    /**
     * @private
     * @param {boolean} [show]
     */
    _updateToolbar(show) {
        if (!this.options.toolbar) return;
        if (!this.options.autohideToolbar && this.toolbar.style.visibility !== 'visible') {
            this.toolbar.style.visibility = 'visible';
        }

        const sel = this.document.defaultView.getSelection();
        if (!sel.anchorNode) {
            show = false;
        }
        if (this.options.autohideToolbar) {
            if (show !== undefined && !this.isMobile) {
                this.toolbar.style.visibility = show ? 'visible' : 'hidden';
            }
            if (show === false) {
                return;
            }
        }
        const paragraphDropdownButton = this.toolbar.querySelector('#paragraphDropdownButton');
        for (const commandState of [
            'italic',
            'underline',
            'strikeThrough',
            'justifyLeft',
            'justifyRight',
            'justifyCenter',
            'justifyFull',
        ]) {
            const isStateTrue = this.document.queryCommandState(commandState);
            const button = this.toolbar.querySelector('#' + commandState);
            if (commandState.startsWith('justify')) {
                if (paragraphDropdownButton) {
                    button.classList.toggle('active', isStateTrue);
                    const direction = commandState.replace('justify', '').toLowerCase();
                    const newClass = `fa-align-${direction === 'full' ? 'justify' : direction}`;
                    paragraphDropdownButton.classList.toggle(newClass, isStateTrue);
                }
            } else if (button) {
                button.classList.toggle('active', isStateTrue);
            }
        }
        if (sel.rangeCount) {
            const closestsStartContainer = closestElement(sel.getRangeAt(0).startContainer, '*');
            const selectionStartStyle = getComputedStyle(closestsStartContainer);

            // queryCommandState('bold') does not take stylesheets into account
            const isBold = Number.parseInt(selectionStartStyle.fontWeight) > 500;
            const button = this.toolbar.querySelector('#bold');
            button.classList.toggle('active', isBold);

            const fontSizeValue = this.toolbar.querySelector('#fontSizeCurrentValue');
            if (fontSizeValue) {
                fontSizeValue.textContent = /\d+/.exec(selectionStartStyle.fontSize).pop();
            }
            const table = getInSelection(this.document, 'table');
            const toolbarButton = this.toolbar.querySelector('.toolbar-edit-table');
            if (toolbarButton) {
                this.toolbar.querySelector('.toolbar-edit-table').style.display = table
                    ? 'block'
                    : 'none';
            }
        }
        this.updateColorpickerLabels();
        const block = closestBlock(sel.anchorNode);
        for (const [style, tag, isList] of [
            ['paragraph', 'P', false],
            ['heading1', 'H1', false],
            ['heading2', 'H2', false],
            ['heading3', 'H3', false],
            ['blockquote', 'BLOCKQUOTE', false],
            ['unordered', 'UL', true],
            ['ordered', 'OL', true],
            ['checklist', 'CL', true],
        ]) {
            const button = this.toolbar.querySelector('#' + style);
            if (button && !block) {
                button.classList.toggle('active', false);
            } else if (button) {
                const isActive = isList
                    ? block.tagName === 'LI' && getListMode(block.parentElement) === tag
                    : block.tagName === tag;
                button.classList.toggle('active', isActive);
            }
        }
        const linkNode = getInSelection(this.document, 'a');
        const linkButton = this.toolbar.querySelector('#createLink');
        linkButton && linkButton.classList.toggle('active', linkNode);
        const unlinkButton = this.toolbar.querySelector('#unlink');
        unlinkButton && unlinkButton.classList.toggle('d-none', !linkNode);
        const undoButton = this.toolbar.querySelector('#undo');
        undoButton && undoButton.classList.toggle('disabled', !this.historyCanUndo());
        const redoButton = this.toolbar.querySelector('#redo');
        redoButton && redoButton.classList.toggle('disabled', !this.historyCanRedo());
        if (this.options.autohideToolbar && !this.isMobile) {
            this._positionToolbar();
        }
    }
    _positionToolbar() {
        const OFFSET = 10;
        let isBottom = false;
        this.toolbar.classList.toggle('toolbar-bottom', false);
        this.toolbar.style.maxWidth = this.editable.offsetWidth - OFFSET * 2 + 'px';
        const sel = this.document.defaultView.getSelection();
        const range = sel.getRangeAt(0);
        const isSelForward =
            sel.anchorNode === range.startContainer && sel.anchorOffset === range.startOffset;
        const selRect = range.getBoundingClientRect();
        const toolbarWidth = this.toolbar.offsetWidth;
        const toolbarHeight = this.toolbar.offsetHeight;
        const editorRect = this.editable.getBoundingClientRect();
        const editorLeftPos = Math.max(0, editorRect.left);
        const editorTopPos = Math.max(0, editorRect.top);
        const scrollX = this.document.defaultView.window.scrollX;
        const scrollY = this.document.defaultView.window.scrollY;

        // Get left position.
        let left = selRect.left + OFFSET;
        // Ensure the toolbar doesn't overflow the editor on the left.
        left = Math.max(editorLeftPos + OFFSET, left);
        // Ensure the toolbar doesn't overflow the editor on the right.
        left = Math.min(editorLeftPos + this.editable.offsetWidth - OFFSET - toolbarWidth, left);
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
        top = Math.min(editorTopPos + this.editable.offsetHeight - OFFSET - toolbarHeight, top);
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
        const cursor = this._historySteps[this._historySteps.length - 1].cursor;
        const { focusOffset, focusNode, anchorNode, anchorOffset } = cursor || {};
        const wasCollapsed = !cursor || (focusNode === anchorNode && focusOffset === anchorOffset);
        if (this.keyboardType === KEYBOARD_TYPES.PHYSICAL || !wasCollapsed) {
            if (ev.inputType === 'deleteContentBackward') {
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oDeleteBackward');
            } else if (ev.inputType === 'deleteContentForward') {
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oDeleteForward');
            } else if (
                ev.inputType === 'insertParagraph' ||
                (ev.inputType === 'insertText' && ev.data === null)
            ) {
                // Sometimes the browser wrongly triggers an insertText
                // input event with null data on enter.
                this.historyRollback();
                ev.preventDefault();
                if (this._applyCommand('oEnter') === UNBREAKABLE_ROLLBACK_CODE) {
                    this._applyCommand('oShiftEnter');
                }
            } else if (['insertText', 'insertCompositionText'].includes(ev.inputType)) {
                // insertCompositionText, courtesy of Samsung keyboard.
                const selection = this.document.defaultView.getSelection();
                // Detect that text was selected and change behavior only if it is the case,
                // since it is the only text insertion case that may cause problems.
                if (anchorNode !== focusNode || anchorOffset !== focusOffset) {
                    ev.preventDefault();
                    this._applyRawCommand('oDeleteBackward');
                    insertText(selection, ev.data);
                    const range = selection.getRangeAt(0);
                    setCursor(range.endContainer, range.endOffset);
                }
                this.sanitize();
                this.historyStep();
            } else if (ev.inputType === 'insertLineBreak') {
                this.historyRollback();
                ev.preventDefault();
                this._applyCommand('oShiftEnter');
            } else {
                this.sanitize();
                this.historyStep();
            }
        }
    }

    /**
     * @private
     */
    _onKeyDown(ev) {
        this.keyboardType =
            ev.key === 'Unidentified' ? KEYBOARD_TYPES.VIRTUAL : KEYBOARD_TYPES.PHYSICAL;
        // If the pressed key has a printed representation, the returned value
        // is a non-empty Unicode character string containing the printable
        // representation of the key. In this case, call `deleteRange` before
        // inserting the printed representation of the character.
        if (/^.$/u.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
            const selection = this.document.defaultView.getSelection();
            if (selection && !selection.isCollapsed) {
                this.deleteRange(selection);
            }
        }
        if (ev.key === 'Backspace' && !ev.ctrlKey && !ev.metaKey) {
            // backspace
            // We need to hijack it because firefox doesn't trigger a
            // deleteBackward input event with a collapsed cursor in front of a
            // contentEditable="false" (eg: font awesome)
            const selection = this.document.getSelection();
            if (selection.isCollapsed) {
                ev.preventDefault();
                this._applyCommand('oDeleteBackward');
            }
        } else if (ev.key === 'Tab') {
            // Tab
            const sel = this.document.getSelection();
            const closestTag = (closestElement(sel.anchorNode, 'li, table') || {}).tagName;

            if (closestTag === 'LI') {
                this._applyCommand('indentList', ev.shiftKey ? 'outdent' : 'indent');
                ev.preventDefault();
            } else if (closestTag === 'TABLE') {
                this._onTabulationInTable(ev);
                ev.preventDefault();
            }
        } else if (isUndo(ev)) {
            // Ctrl-Z
            ev.preventDefault();
            ev.stopPropagation();
            this.historyUndo();
        } else if (isRedo(ev)) {
            // Ctrl-Y
            ev.preventDefault();
            ev.stopPropagation();
            this.historyRedo();
        }
    }
    /**
     * @private
     */
    _onSelectionChange() {
        // Compute the current cursor on selectionchange but do not record it. Leave
        // that to the command execution or the 'input' event handler.
        this._computeHistoryCursor();

        const selection = this.document.defaultView.getSelection();
        const isSelectionInEditable =
            !selection.isCollapsed &&
            this.editable.contains(selection.anchorNode) &&
            this.editable.contains(selection.focusNode);
        this._updateToolbar(isSelectionInEditable);

        if (this._currentMouseState === 'mouseup') {
            this._fixFontAwesomeSelection();
        }

        // When the browser set the selection inside a node that is
        // contenteditable=false, it breaks the edition upon keystroke. Move the
        // selection so that it remain in an editable area. An example of this
        // case happend when the selection goes into a fontawesome node.
        const startContainer =
            selection.rangeCount && closestElement(selection.getRangeAt(0).startContainer);
        const contenteditableFalseNode =
            startContainer &&
            !startContainer.isContentEditable &&
            ancestors(startContainer, this.editable).includes(this.editable) &&
            startContainer.closest('[contenteditable=false]');
        if (contenteditableFalseNode) {
            selection.removeAllRanges();
            const range = new Range();
            if (contenteditableFalseNode.previousSibling) {
                range.setStart(
                    contenteditableFalseNode.previousSibling,
                    contenteditableFalseNode.previousSibling.length,
                );
                range.setEnd(
                    contenteditableFalseNode.previousSibling,
                    contenteditableFalseNode.previousSibling.length,
                );
            } else {
                range.setStart(contenteditableFalseNode.parentElement, 0);
                range.setEnd(contenteditableFalseNode.parentElement, 0);
            }
            selection.addRange(range);
        }
    }

    _onMouseup(ev) {
        this._currentMouseState = ev.type;

        this._fixFontAwesomeSelection();
    }

    _onMouseDown(ev) {
        this._currentMouseState = ev.type;

        // When selecting all the text within a link then triggering delete or
        // inserting a character, the cursor and insertion is outside the link.
        // To avoid this problem, we make all editable zone become uneditable
        // except the link. Then when cliking outside the link, reset the
        // editable zones.
        this.automaticStepSkipStack();
        const link = closestElement(ev.target, 'a');
        if (link && !link.querySelector('div') && !closestElement(ev.target, '.o_not_editable')) {
            const editableChildren = link.querySelectorAll('[contenteditable=true]');
            this._stopContenteditable();
            [...editableChildren, link].forEach(node => node.setAttribute('contenteditable', true));
        } else {
            this._activateContenteditable();
        }

        const node = ev.target;
        // handle checkbox lists
        if (node.tagName == 'LI' && getListMode(node.parentElement) == 'CL') {
            if (ev.offsetX < 0) {
                toggleClass(node, 'o_checked');
                ev.preventDefault();
            }
        }
    }

    _onDocumentKeydown(ev) {
        const canUndoRedo = !['INPUT', 'TEXTAREA'].includes(this.document.activeElement.tagName);

        if (this.options.controlHistoryFromDocument && canUndoRedo) {
            if (isUndo(ev) && canUndoRedo) {
                ev.preventDefault();
                this.historyUndo();
            } else if (isRedo(ev) && canUndoRedo) {
                ev.preventDefault();
                this.historyRedo();
            }
        } else {
            if (isRedo(ev) || isUndo(ev)) {
                this._onKeyupResetContenteditableNodes.push(
                    ...this.editable.querySelectorAll('[contenteditable=true]'),
                );
                if (this.editable.getAttribute('contenteditable') === 'true') {
                    this._onKeyupResetContenteditableNodes.push(this.editable);
                }

                for (const node of this._onKeyupResetContenteditableNodes) {
                    this.automaticStepSkipStack();
                    node.setAttribute('contenteditable', false);
                }
            }
        }
    }

    _onDocumentKeyup() {
        if (this._onKeyupResetContenteditableNodes.length) {
            for (const node of this._onKeyupResetContenteditableNodes) {
                this.automaticStepSkipStack();
                node.setAttribute('contenteditable', true);
            }
            this._onKeyupResetContenteditableNodes = [];
        }
    }

    /**
     * Prevent the pasting of HTML and paste text only instead.
     */
    _onPaste(ev) {
        ev.preventDefault();
        const pastedText = (ev.originalEvent || ev).clipboardData.getData('text/plain');
        this.execCommand('insertText', pastedText);
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
            if (ancestor === this.editable) {
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
                insertText(this.document.defaultView.getSelection(), pastedText);
            });
        }
        this.historyStep();
    }

    _bindToolbar() {
        for (const buttonEl of this.toolbar.querySelectorAll('[data-call]')) {
            buttonEl.addEventListener('mousedown', ev => {
                this.execCommand(buttonEl.dataset.call, buttonEl.dataset.arg1);

                ev.preventDefault();
                this._updateToolbar();
            });
        }
    }
    _onTabulationInTable(ev) {
        const sel = this.document.getSelection();
        const closestTable = closestElement(sel.anchorNode, 'table');
        if (!closestTable) {
            return;
        }
        const closestTd = closestElement(sel.anchorNode, 'td');
        const tds = [...closestTable.querySelectorAll('td')];
        const direction = ev.shiftKey ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
        const cursorDestination =
            tds[tds.findIndex(td => closestTd === td) + (direction === DIRECTIONS.LEFT ? -1 : 1)];
        if (cursorDestination) {
            setCursor(...startPos(cursorDestination), ...endPos(cursorDestination), true);
        } else if (direction === DIRECTIONS.RIGHT) {
            this._addRowBelow();
            this._onTabulationInTable(ev);
        }
    }

    /**
     * Fix the current selection range in case the range start or end inside a fontAwesome node
     */
    _fixFontAwesomeSelection() {
        const selection = this.document.defaultView.getSelection();
        if (
            selection.isCollapsed ||
            (selection.anchorNode &&
                !ancestors(selection.anchorNode, this.editable).includes(this.editable))
        )
            return;
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
            if (fixedSelection.anchorNode) {
                fixedSelection.anchorOffset =
                    selectionDirection === DIRECTIONS.RIGHT ? fixedSelection.anchorNode.length : 0;
            } else {
                fixedSelection.anchorNode = closestAnchorNodeEl.parentElement;
                fixedSelection.anchorOffset = 0;
            }
        }
        // check and fix focus node
        const closestFocusNodeEl = closestElement(selection.focusNode);
        if (isFontAwesome(closestFocusNodeEl)) {
            shouldUpdateSelection = true;
            fixedSelection.focusNode =
                selectionDirection === DIRECTIONS.RIGHT
                    ? closestFocusNodeEl.nextSibling
                    : closestFocusNodeEl.previousSibling;
            if (fixedSelection.focusNode) {
                fixedSelection.focusOffset =
                    selectionDirection === DIRECTIONS.RIGHT ? 0 : fixedSelection.focusNode.length;
            } else {
                fixedSelection.focusNode = closestFocusNodeEl.parentElement;
                fixedSelection.focusOffset = 0;
            }
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
