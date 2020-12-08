"use strict";

import {
    childNodeIndex,
    closestBlock,
    findLeadingSpaceNextNode,
    findPreviousInline,
    findTrailingSpacePrevNode,
    isBlock,
    isContentTextNode,
    isFakeLineBreak,
    isInvisibleChar,
    isRealLineBreak,
    isSpace,
    isUnbreakable,
    isVisibleStr,
    mergeNodes,
    MERGE_CODES,
    nodeSize,
    setCursor,
} from "../utils/utils.js";

Text.prototype.oDeleteBackward = function (offset) {
};

HTMLElement.prototype.oDeleteBackward = function (offset) {
    if (offset > 0) {
        const nodeToRemove = this.childNodes[offset - 1];
        if (nodeToRemove.nodeType === Node.TEXT_NODE) {
            nodeToRemove.remove();
        }
    }
};

HTMLLIElement.prototype.oDeleteBackward = function (offset) {
    // FIXME On Firefox, backspace in LI at offset 0 is not detected if the LI
    // still contains text as contentEditable does nothing so no 'input' event
    // is fired and nothing can be rollbacked: how to handle that ??

    if (offset > 0 || this.previousElementSibling) {
        // If backspace inside li content or if the li is not the first one,
        // it behaves just like in a normal element.
        HTMLElement.prototype.oDeleteBackward.call(this, offset);
        return;
    }
    // Backspace at the start of the first LI element...
    if (this.parentElement.closest('li')) {
        // ... for sub-menus: unindent
        this.oShiftTab(offset);
        return;
    }
    // ... for main menus: move LI content to a new external <p/>
    const pEl = document.createElement('p');
    const brEl = document.createElement('br');
    pEl.appendChild(brEl);
    this.parentElement.before(pEl);
    mergeNodes(pEl, this);
};

// Utils
// TODO review how this works, all method on prototype or all methods as utils
// but a mix of both seems strange. Maybe a wrapper jQuery-like?

/**
 * TODO review the whole logic of having to use oRemove instead of remove...
 */
Text.prototype.oRemove = function () {
    this.remove();
};
HTMLElement.prototype.oRemove = function () {
    this.remove();
};
HTMLLIElement.prototype.oRemove = function () {
    const parentEl = this.parentElement;
    this.remove();
    if (!parentEl.children.length) {
        parentEl.remove();
    }
};
