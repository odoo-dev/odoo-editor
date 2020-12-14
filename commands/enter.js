"use strict";

import {UNBREAKABLE_ROLLBACK_CODE} from "../editor.js";

import {
    childNodeIndex,
    clearEmpty,
    fillEmpty,
    isBlock,
    moveMergedNodes,
    prepareUpdate,
    setCursorStart,
    setTagName,
    splitTextNode,
} from "../utils/utils.js";

Text.prototype.oEnter = function (offset) {
    this.parentElement.oEnter(splitTextNode(this, offset), true);
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
    // First split the node in two and move half the children in the clone.
    const splitEl = this.cloneNode(false);
    this.after(splitEl);
    // FIXME fail because moveMergedNode prepareUpdate is done to late: we
    // already added the splitEl element (and we cannot add it after for the
    // opposite reason)... maybe this is possible to review moveMergedNodes API
    // to accept doing something after prepareUpdate / before its restore calls
    moveMergedNodes(splitEl, 0, this, offset, this.childNodes.length, true);

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

        setCursorStart(splitEl); // TODO review
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
HTMLLIElement.prototype.oEnter = function (offset, firstSplit = true) {
    // If not last list item or not empty last item, regular block split
    if (this.nextElementSibling || this.textContent) {
        return HTMLElement.prototype.oEnter.call(this, ...arguments);
    }
    this.oShiftTab();
};
