"use strict";

import {
    childNodeIndex,
    findTrailingSpacePrevNode,
    findLeadingSpaceNextNode,
    isInvisibleChar,
    isSpace,
    isUnbreakable,
    mergeNodes,
    MERGE_CODES,
    nodeSize,
    setCursor,
    isVisibleStr,
} from "../utils/utils.js";

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

    if (!this.length) {
        // TODO maybe this is not a good idea, to check: when a text node is
        // emptied, automatically add a BR after it to make potential
        // previous BR visible.
        this.after(document.createElement('br'));
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
    const mergeResult = mergeNodes(node);
    switch (mergeResult) {
        // Merge succeeded, nothing more to be done.
        case MERGE_CODES.SUCCESS: {
            break;
        }
        // The merge resulted in removing the left node because it was invisible
        // (empty span, empty text node, ...), continue propagation of the
        // backspace command
        case MERGE_CODES.REMOVED_INVISIBLE_NODE: {
            this.oDeleteBackward(offset - 1);
            break;
        }
        // The merge resulted in removind a visible node (like trying to merge
        // a text into an image, a br, ...). The backspace command is finished.
        case MERGE_CODES.REMOVED_VISIBLE_NODE: {
            setCursor(this, Math.min(this.childNodes.length, offset - 1));
            break;
        }
        // The merge was not possible to be performed (example: mixing inline
        // nodes) -> propagate the backspace.
        case MERGE_CODES.NOTHING_TO_MERGE: {
            node.oDeleteBackward(nodeSize(node));
        }
    }
};

HTMLLIElement.prototype.oDeleteBackward = function (offset) {
    // FIXME On Firefox, backspace in LI at offset 0 is not detected if the LI
    // still contains text as contentEditable does nothing so no 'input' event
    // is fired and nothing can be rollbacked: how to handle that ??

    if (offset > 0 || this.previousElementSibling) {
        // If backspace inside li content or if the li is not the first one,
        // it behaves just like a normal element.
        HTMLElement.prototype.oDeleteBackward.call(this, offset);
        return;
    }
    // Backspace at the start of an LI element...
    if (this.parentElement.closest('li')) {
        // ... for sub-menus: unindented
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
