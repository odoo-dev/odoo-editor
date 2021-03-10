import {
    childNodeIndex,
    getListMode,
    isBlock,
    preserveCursor,
    setTagName,
    toggleClass,
    insertListAfter,
    getAdjacents,
} from '../utils/utils.js';

Text.prototype.oToggleList = function (offset, mode) {
    this.parentElement.oToggleList(childNodeIndex(this), mode);
};

HTMLElement.prototype.oToggleList = function (offset, mode = 'UL') {
    if (!isBlock(this)) {
        return this.parentElement.oToggleList(childNodeIndex(this));
    }
    let inLI = this.closest('li');
    if (inLI) {
        return inLI.oToggleList(0, mode);
    }
    const restoreCursor = preserveCursor(this.ownerDocument);
    // if `this` is the root editable
    if (this.oid === 1) {
        const callingNode = this.childNodes[offset];
        const group = getAdjacents(callingNode, n => !isBlock(n));
        insertListAfter(callingNode, mode, [group]);
        restoreCursor();
    } else {
        const list = insertListAfter(this, mode, [this]);
        restoreCursor(new Map([[this, list.firstElementChild]]));
    }
};

HTMLParagraphElement.prototype.oToggleList = function (offset, mode = 'UL') {
    const restoreCursor = preserveCursor(this.ownerDocument);
    const list = insertListAfter(this, mode, [[...this.childNodes]]);
    this.remove();

    restoreCursor(new Map([[this, list.firstChild]]));
    return true;
};

HTMLLIElement.prototype.oToggleList = function (offset, mode) {
    let pnode = this.closest('ul, ol');
    if (!pnode) return;
    const restoreCursor = preserveCursor(this.ownerDocument);
    switch (getListMode(pnode) + mode) {
        case 'OLCL':
        case 'ULCL':
            pnode.classList.add('o_checklist');
            for (let li = pnode.firstElementChild; li !== null; li = li.nextElementSibling) {
                if (li.style.listStyle != 'none') {
                    li.style.listStyle = null;
                    if (!li.style.all) li.removeAttribute('style');
                }
            }
            setTagName(pnode, 'UL');
            break;
        case 'CLOL':
        case 'CLUL':
            toggleClass(pnode, 'o_checklist');
        case 'OLUL':
        case 'ULOL':
            setTagName(pnode, mode);
            break;
        default:
            // toggle => remove list
            let node = this;
            while (node) {
                node = node.oShiftTab(offset);
            }
    }
    restoreCursor();
    return false;
};

HTMLTableCellElement.prototype.oToggleList = function (offset, mode) {
    const restoreCursor = preserveCursor(this.ownerDocument);
    const callingNode = this.childNodes[offset];
    const group = getAdjacents(callingNode, n => !isBlock(n));
    insertListAfter(callingNode, mode, [group]);
    restoreCursor();
};
