"use strict";

import {UNBREAKABLE_ROLLBACK_CODE} from "../editor.js";

import {
    blockify,
    childNodeIndex,
    clearEmpty,
    fillEmpty,
    isBlock,
    isUnbreakable,
    setCursor,
    setCursorStart,
    setTagName,
    splitText,
} from "../utils/utils.js";

Text.prototype.oEnter = function (offset) {
    this.parentElement.oEnter(splitText(this, offset), true);
};
/**
 * The whole logic can pretty much be described by this example:
 *
 *     <p><span><b>[]xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b>[]<b>xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b></span>[]<span><b>xt</b>ab</span>cd</p> + ENTER
 * <=> <p><span><b><br></b></span></p><p><span><b>[]xt</b>ab</span>cd</p> + SANITIZE
 * <=> <p><br></p><p><span><b>[]xt</b>ab</span>cd</p>
 *
 * Propagate the split for as long as we split an inline node, then refocus the
 * beginning of the first split node
 */
HTMLElement.prototype.oEnter = function (offset, firstSplit = true) {
    if (isUnbreakable(this)) {
        throw UNBREAKABLE_ROLLBACK_CODE;
    }
    if (firstSplit) {
        blockify(this, offset);
    }

    // First split the node in two and move half the children in the clone.
    const splitEl = this.cloneNode(false);
    while (offset < this.childNodes.length) {
        splitEl.appendChild(this.childNodes[offset]);
    }
    this.after(splitEl);

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

    // All split have been done, place the cursor at the right position, and
    // fill/remove empty nodes.
    if (firstSplit) {
        fillEmpty(clearEmpty(this));
        fillEmpty(splitEl);
        setCursorStart(splitEl);
    }
};
/**
 * Specific behavior for headings: do not split in two if cursor at the end but
 * instead create a paragraph.
 * Cursor end of line: <h1>title[]</h1> + ENTER <=> <h1>title</h1><p>[]<br/></p>
 * Cursor in the line: <h1>tit[]le</h1> + ENTER <=> <h1>tit</h1><h1>[]le</h1>
 */
HTMLHeadingElement.prototype.oEnter = function () {
    HTMLElement.prototype.oEnter.call(this, ...arguments);
    const newEl = this.nextSibling;
    if (!newEl.textContent) {
        setTagName(newEl, 'P');
    }
};
/**
 * Specific behavior for list items: deletion and unindentation in some cases.
 */
HTMLLIElement.prototype.oEnter = function () {
    // If not last list item or not empty last item, regular block split
    if (this.nextElementSibling || this.textContent) {
        return HTMLElement.prototype.oEnter.call(this, ...arguments);
    }

    // If nested LI (empty and last), shiftTab
    if (this.parentNode.closest('li')) {
        this.oShiftTab();
        return;
    }

    // Otherwise, regular list item, empty and last: convert to a paragraph
    const pEl = document.createElement('p');
    const brEl = document.createElement('br');
    pEl.appendChild(brEl);
    this.closest('ul, ol').after(pEl);
    this.oRemove();
    setTimeout(() => setCursor(pEl, 0), 0); // FIXME investigate why setTimeout needed in this case...
};
