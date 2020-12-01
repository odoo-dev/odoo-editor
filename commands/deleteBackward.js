"use strict";

import {
    childNodeIndex,
    findTrailingSpacePrevNode,
    findLeadingSpaceNextNode,
    isBlock,
    isInvisibleChar,
    isSpace,
    isUnbreakable,
    isVisible,
    isVisibleEmpty,
    nodeSize,
    prepareMergeLocation,
    setCursor,
    setCursorEnd,
    isVisibleStr,
} from "../utils/utils.js";

const MERGE_SUCCESS = 100;
const MERGE_NOTHING_TO_MERGE = 101;
const MERGE_REMOVED_INVISIBLE_NODE = 102;
const MERGE_REMOVED_VISIBLE_NODE = 103;

Text.prototype.oDeleteBackward = function (offset) {
    const value = this.nodeValue;
    const textLength = this.length;
    let firstExcludedCharIndex = offset - 1; // Start index of the characters to remove
    let firstIncludedCharIndex = offset; // End index of the characters to remove + 1

    const expandRemovalRange = callback => {
        while (callback(value.charAt(firstExcludedCharIndex))) {
            firstExcludedCharIndex--;
        }
        while (callback(value.charAt(firstIncludedCharIndex))) {
            firstIncludedCharIndex++;
        }
    };

    // Remove zero-width characters around the cursor position
    expandRemovalRange(ch => isInvisibleChar(ch));

    // If beginning of string, now simply remove the starting invisible
    // characters we found and propagate the backspace to the text node parent.
    if (firstExcludedCharIndex < 0) {
        this.nodeValue = value.substring(firstIncludedCharIndex);
        const parentOffset = childNodeIndex(this) + (this.length ? 0 : 1);
        return this.parentElement.oDeleteBackward(parentOffset);
    }

    // 'firstExcludedCharIndex' now points at the character the user actually
    // wants to remove. If it is a space removal, we have to remove the
    // surrounding collapsed spaces too.
    const spaceRemoval = isSpace(value.charAt(firstExcludedCharIndex));
    if (spaceRemoval) {
        firstExcludedCharIndex--;
        expandRemovalRange(ch => isSpace(ch) || isInvisibleChar(ch));
        firstExcludedCharIndex++;
    }

    // Now remove all the characters that we found to remove
    const leftStr = value.substring(0, firstExcludedCharIndex);
    const rightStr = value.substring(firstIncludedCharIndex);
    this.nodeValue = leftStr + rightStr;

    // Now handle transformation of whitespaces into &nbsp; when collapsing two
    // non-collapsed groups of whitespaces (in or out of the node) + propagate
    // leading/trailing collapsed whitespace removal.
    if (firstExcludedCharIndex > 0 && firstIncludedCharIndex < textLength) {
        if (!spaceRemoval && /[^\S\u00A0]$/.test(leftStr) && /^[^\S\u00A0]/.test(rightStr)) {
            // _a[]_ -> two non collapsed spaces would now be collapsed in the node
            this.nodeValue = leftStr + rightStr.replace(/^[^\S\u00A0]+/, '\u00A0');
        }
    } else {
        // In the special case we removed the last character of the string, we
        // could replace multiple spaces by nbsp if we consider both leading
        // and trailing ones. This variable is there to ensure we only replace
        // one space.
        let alreadyTransformed = false;

        // Leading character removal: special cases
        if (firstExcludedCharIndex <= 0) {
            const trailingSpacePrevNode = findTrailingSpacePrevNode(this.parentElement, childNodeIndex(this));

            if (trailingSpacePrevNode) {
                if (spaceRemoval) {
                    // <b>_</b>_[] -> propagate the backspace to originally collapsed spaces of siblings
                    trailingSpacePrevNode.oDeleteBackward(trailingSpacePrevNode.length);
                } else if (!alreadyTransformed) {
                    // <b>_</b>a[]_ -> two non collapsed spaces would now be collapsed, accross different nodes
                    trailingSpacePrevNode.nodeValue = trailingSpacePrevNode.nodeValue.replace(/[^\S\u00A0]+$/, '\u00A0');
                    alreadyTransformed = true;
                }
            } else if (!alreadyTransformed && isVisibleStr(this)) {
                // <b>a</b>a[]_a -> a single space would become invisible
                this.nodeValue = this.nodeValue.replace(/^[^\S\u00A0]+/, '\u00A0');
                alreadyTransformed = true;
            }
        }
        // Trailing character removal: special cases
        if (firstIncludedCharIndex >= textLength) {
            const leadingSpaceNextNode = findLeadingSpaceNextNode(this.parentElement, childNodeIndex(this) + 1);

            if (leadingSpaceNextNode) {
                if (spaceRemoval) {
                    // _[]<b>_</b> -> propagate the backspace to originally collapsed spaces of siblings
                    leadingSpaceNextNode.oDeleteBackward(leadingSpaceNextNode.nodeValue.search(/[^\S\u00A0]/) + 1);
                } else if (!alreadyTransformed) {
                    // _a[]<b>_</b> -> two non collapsed spaces would now be collapsed, accross different nodes
                    leadingSpaceNextNode.nodeValue = leadingSpaceNextNode.nodeValue.replace(/^[^\S\u00A0]+/, '\u00A0');
                }
            } else if (!alreadyTransformed && isVisibleStr(this)) {
                // a_a[]<b>a</b> -> a single visible space would become invisible
                this.nodeValue = this.nodeValue.replace(/[^\S\u00A0]+$/, '\u00A0');
            }
        }
    }

    setCursor(this, Math.min(leftStr.length, this.length));
};

HTMLElement.prototype.oDeleteBackward = function (offset) {
    if (offset === 0) {
        // We are at the start of a node, propagate to the parent, with the
        // cursor on the right if the current node is empty, on the left
        // otherwise. Except if unbreakable or the last child element of an
        // unbreakable, in that case we do nothing.
        const pEl = this.parentElement;
        if (isUnbreakable(this)
                || isUnbreakable(pEl) && pEl.childNodes.length === 1 && pEl.firstChild === this) {
            // TODO review that logic, it made sense when AGE explained it but
            // then they have an opposite test which removes the last p if there
            // is surrounding text node ab<p>[]cd</p> should apparently drop the
            // p but not if there is no ab...
            return;
        }
        const parentOffset = childNodeIndex(this) + (this.childNodes.length ? 0 : 1);
        pEl.oDeleteBackward(parentOffset);
        return;
    }

    // Now the cursor is on the right of a node. Merge adjacent nodes.
    const node = this.childNodes[offset - 1];
    const mergeResult = mergeNextNodeInto(node);
    switch (mergeResult) {
        // Merge succeeded, nothing more to be done.
        case MERGE_SUCCESS: {
            break;
        }
        // The merge resulted in removing the left node because it was invisible
        // (empty span, empty text node, ...), continue propagation of the
        // backspace command
        case MERGE_REMOVED_INVISIBLE_NODE: {
            this.oDeleteBackward(offset - 1);
            break;
        }
        // The merge resulted in removind a visible node (like trying to merge
        // a text into an image, a br, ...). The backspace command is finished.
        case MERGE_REMOVED_VISIBLE_NODE: {
            setCursor(this, offset - 1);
            break;
        }
        // The merge was not possible to be performed (example: mixing inline
        // nodes) -> propagate the backspace.
        case MERGE_NOTHING_TO_MERGE: {
            node.oDeleteBackward(nodeSize(node));
        }
    }
};

HTMLLIElement.prototype.oDeleteBackward = function (offset) {
    if (offset === 0) {
        if (this.parentElement.closest('li')) {
            // If backspace at the start of a unique indented list element, then
            // unindented and that's it.
            this.oShiftTab(offset);
            return;
        } else if (!this.previousElementSibling) {
            // Outside of ul -> p ?
        }
    }
    HTMLElement.prototype.oDeleteBackward.call(this, offset);
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

/**
 * Merges the next sibling of the given node into that given node, the way it is
 * done depending of the type of those nodes.
 *
 * @param {Node} node
 * @returns {number} Merge type code
 */
function mergeNextNodeInto(node) {
    const leftNode = node;
    if (!isVisible(leftNode)) {
        leftNode.oRemove(); // TODO review the use of 'oRemove' ...
        return MERGE_REMOVED_INVISIBLE_NODE;
    }

    if (isVisibleEmpty(node)) {
        leftNode.oRemove(); // TODO review the use of 'oRemove' ...
        return MERGE_REMOVED_VISIBLE_NODE;
    }

    const rightNode = node.nextSibling;
    if (!rightNode) {
        return MERGE_NOTHING_TO_MERGE;
    }

    const leftIsBlock = isBlock(leftNode);
    const rightIsBlock = isBlock(rightNode);

    if (rightIsBlock) {
        // First case, the right side is block content: we have to unwrap that
        // content in the proper location.
        if (leftIsBlock) {
            // If the left side is a block, find the right position to unwrap
            // right content.
            const positionEl = prepareMergeLocation(leftNode, rightNode);
            setCursorEnd(positionEl);
            while (rightNode.firstChild) {
                positionEl.appendChild(rightNode.firstChild);
            }
            rightNode.oRemove(); // TODO review the use of 'oRemove' ...
        } else {
            // If the left side is inline, simply unwrap at current block location.
            setCursorEnd(leftNode);
            while (rightNode.lastChild) {
                rightNode.after(rightNode.lastChild);
            }
            rightNode.oRemove(); // TODO review the use of 'oRemove' ...
        }
    } else {
        // Second case, the right side is inline content
        if (leftIsBlock) {
            // If the left side is a block, move that inline content and the
            // one which follows in that left side.
            const positionEl = prepareMergeLocation(leftNode, rightNode);
            setCursorEnd(positionEl);
            let node = rightNode;
            do {
                let nextNode = node.nextSibling;
                positionEl.appendChild(node);
                node = nextNode;
            } while (node && !isBlock(node));
        } else {
            // If the left side is also inline, nothing to merge.
            return MERGE_NOTHING_TO_MERGE;
        }
    }

    return MERGE_SUCCESS;
}
