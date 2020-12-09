"use strict";

import {
    childNodeIndex,
    DIRECTIONS,
    getState,
    isBlock,
    isUnbreakable,
    mergeNodes,
    MERGE_CODES,
    nodeSize,
    prepareUpdate,
    setCursor,
    splitTextNode,
    STATES,
} from "../utils/utils.js";

Text.prototype.oDeleteBackward = function (offset) {
    const parentNode = this.parentNode;

    if (!offset) {
        // Backspace at the beginning of a text node, we have to propagate
        // the backspace to the parent.
        const parentOffset = childNodeIndex(this);
        if (!this.length) {
            this.remove();
        }
        parentNode.oDeleteBackward(parentOffset);
        return;
    }

    // First, split after the character where the backspace occurs and prepare
    // to restore the right part following that character removal.
    const firstSplitOffset = splitTextNode(this, offset);
    const restoreRight = prepareUpdate(parentNode, firstSplitOffset, DIRECTIONS.LEFT);
    const middleNode = parentNode.childNodes[firstSplitOffset - 1];

    // Get the left state at the split location so that we know if the backspace
    // must propagate after the character removal.
    const [leftState] = getState(parentNode, firstSplitOffset, DIRECTIONS.LEFT);

    // Then, split before the character where the backspace occurs and prepare
    // to restore the left part following that character removal.
    const secondSplitOffset = splitTextNode(middleNode, middleNode.length - 1);
    const restoreLeft = prepareUpdate(parentNode, secondSplitOffset, DIRECTIONS.RIGHT);

    // Do remove the character, then restore the state of the surrounding parts.
    middleNode.remove();
    restoreRight();
    restoreLeft();

    // If the removed element was not visible content, propagate the backspace.
    if (leftState === STATES.BLOCK) {
        parentNode.oDeleteBackward(secondSplitOffset);
        return;
    }

    setCursor(parentNode, secondSplitOffset);
};

HTMLElement.prototype.oDeleteBackward = function (offset) {
    if (offset === 0) {
        // If backspace at the beginning of an unbreakable or the last child
        // element of an unbreakable, in that case we do nothing.
        const pEl = this.parentElement;
        if (isUnbreakable(this)
                || isUnbreakable(pEl) && pEl.childNodes.length === 1 && pEl.firstChild === this) {
            // TODO review that logic, it made sense when AGE explained it but
            // then they have an opposite test which removes the last p if there
            // is surrounding text node ab<p>[]cd</p> should apparently drop the
            // p but not if there is no ab...
            return;
        }

        if (!this.childNodes.length) {
            // Backspace at the beginning of an empty node: convert to backspace
            // after that empty node (propagate to parent node)
            //
            //     <p>abc<span>[]</span>def</p> + BACKSPACE
            // <=> <p>abc<span></span>[]def</p> + BACKSPACE
            const parentOffset = childNodeIndex(this) + 1;
            pEl.oDeleteBackward(parentOffset);
            return;
        }

        // Backspace at the beginning of a non-empty node: first move the
        // following *block* (if any) outside of its parent, then in any case
        // convert to backspace between parent element and its previous sibling
        //
        // 1°)
        //     <div>ab</div><section>[]<p>cd</p>ef</section> + BACKSPACE
        // <=> <div>ab</div>[]<p>cd</p><section>ef</section> + BACKSPACE
        //
        // 2°)
        //     <div>ab</div><section>[]cd<p>ef</p></section> + BACKSPACE
        // <=> <div>ab</div>[]<section>cd<p>ef</p></section> + BACKSPACE
        const parentOffset = childNodeIndex(this);
        // TODO should ignore invisible text nodes at the beginning (review
        // findNode and other methods to do that more easily).
        if (isBlock(this.firstChild)) {
            this.before(this.firstChild);
            if (!this.childNodes.length) {
                this.oRemove();
            }
        }
        pEl.oDeleteBackward(parentOffset);
        return;
    }

    // Now the cursor is on the right of a node. Merge it with its next sibling
    // node if any (node: mergeNodes also handle the case where is there is no
    // next sibling or if the left node is something that cannot or should not
    // receive content to merge: e.g. the removal of a <br> for instance).
    const node = this.childNodes[offset - 1];
    const mergeResult = mergeNodes(node);
    switch (mergeResult) {
        // Merge succeeded, nothing more to be done, the backspace command
        // visually removed something for the user.
        case MERGE_CODES.SUCCESS: {
            break;
        }
        // The merge resulted in removing the left node because it was invisible
        // (empty span, empty text node, ...), continue propagation of the
        // backspace command as we did not remove anything visible to the user.
        case MERGE_CODES.REMOVED_INVISIBLE_NODE: {
            this.oDeleteBackward(offset - 1);
            break;
        }
        // The merge resulted in removing the left node alone (backspace after a
        // <br> for instance). The backspace command is done, the cursor just
        // have to be repositioned properly.
        case MERGE_CODES.REMOVED_VISIBLE_NODE: {
            setCursor(this, offset - 1);
            break;
        }
        // The merge was not possible to be performed (example: mixing inline
        // nodes) -> propagate the backspace.
        case MERGE_CODES.NOTHING_TO_MERGE: {
            node.oDeleteBackward(nodeSize(node));
            break;
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
    this.oShiftTab(offset);
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
