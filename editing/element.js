"use strict";

import {UNBREAKABLE_ROLLBACK_CODE} from "../editor.js";

import {
    childNodeIndex, fillEmpty, isBlock, isUnbreakable, latestChild,
    setCursor, setCursorEnd
} from "../utils/utils.js";

/**
 * The whole logic can pretty much be described by this example:
 *
 *     <p><span><b>[]xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b>[]<b>xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b></span>[]<span><b>xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b></span></p><p><span><b>[]xt</b>ab</span>cd</p>
 *
 * Propagate the split for as long as we split an inline node, then refocus the
 * beginning of the first split node
 */
HTMLElement.prototype.oEnter = function (offset, firstSplit = true) {
    if (isUnbreakable(this)) {
        throw UNBREAKABLE_ROLLBACK_CODE;
    }

    // First split the node in two and move half the children in the clone.
    const splitEl = this.cloneNode(false);
    while (offset < this.childNodes.length) {
        splitEl.appendChild(this.childNodes[offset]);
    }
    this.after(splitEl);

    // If required (first split), fill the original and clone node with a <br/>
    // if they are empty
    // TODO in the example above, the <b><br></b> would be removed by jabberwock
    // to see if this is in fact needed or if we keep as it is here by
    // simplicity: "the cursor was in the <b> so we split it in two no matter
    // what", or maybe this should be done in sanitization code.
    if (firstSplit) {
        fillEmpty(this);
        fillEmpty(splitEl);
    }

    // Propagate the split until reaching a block element
    if (!isBlock(this)) {
        if (this.parentElement) {
            this.parentElement.oEnter(childNodeIndex(this) + 1, false);
        } else {
            // There was no block parent element in the original chain, consider
            // this unsplittable, like an unbreakable.
            throw UNBREAKABLE_ROLLBACK_CODE;
        }
    }

    // All split have been done, place the cursor at the right position
    if (firstSplit) {
        setCursor(splitEl, 0);
    }
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    const brEl = document.createElement('BR'); // TODO check the addBr function ?
    this.before(brEl);
    if (offset >= this.childNodes.length) {
        this.appendChild(brEl);
    } else {
        this.insertBefore(brEl, this.childNodes[offset]);
    }
};

HTMLElement.prototype.oDeleteBackward = function (offset) {
    console.log('oDeleteBackward Element');

    // TODO this next block of code is just temporary after the "offset"
    // refactoring the other methods were adapted but not the oDeleteBackward
    // ones.
    let node = this;
    if (offset > 0) {
        node = this.childNodes[offset - 1];
        node.oDeleteBackward(node.nodeType === Node.TEXT_NODE ? node.length : undefined);
        return;
    } else {
        offset = undefined;
    }

    if (isUnbreakable(this)) {
        return false;
    }
    // merge with previous block
    node = this.previousSibling;
    if (isBlock(this) || isBlock(node)) {
        node = this.previousSibling || this.parentElement;
        node.oMove(this);
        return true;
    }
    let next = latestChild(this.previousSibling) || this.parentElement;
    if (!this.textContent) {
        this.remove();
    }
    return next.oDeleteBackward();
};

HTMLElement.prototype.oDeleteForward = function () {

};

HTMLElement.prototype.oTab = function (offset) {
    if (!isBlock(this)) {
        return this.parentElement.oTab(offset);
    }
    return false;
};

HTMLElement.prototype.oShiftTab = function (offset = undefined) {
    if (!isBlock(this)) {
        return this.parentElement.oShiftTab(offset);
    }
    return false;
};

// Element Utils

HTMLElement.prototype.oRemove = function () {
    console.log('oRemove Element');
    let pe = this.parentElement;

    this.remove();
    if (!isBlock(this)) {
        pe.oRemove();
    }
};

HTMLElement.prototype.oMove = function (src) {
    // TODO: check is this is unBreackable
    if (isUnbreakable(src) || isUnbreakable(this)) {
        return true;
    }
    setCursorEnd(this);
    if (isBlock(src)) {
        let node = latestChild(this);
        // remove invisible stuff until block or text content found
        while (!isBlock(node) && !(node.nodeType === Node.TEXT_NODE && (node.nodeValue.replace(/[ \n\t\r]/, '')))) {
            let old = node;
            node = latestChild(node.previousSibling) || node.parentNode;
            old.remove();
        }
        while (src.firstChild) {
            this.append(src.firstChild);
        }
        src.remove();
     } else {
        let node = src;
        while (node && !isBlock(node)) {
            let next = node.nextSibling;
            this.append(node);
            node = next;
        }
    }
    // setCursorEnd(this);
};
