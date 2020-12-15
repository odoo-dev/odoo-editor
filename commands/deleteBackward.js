"use strict";

import {
    boundariesOut,
    childNodeIndex,
    CTGROUPS,
    CTYPES,
    DIRECTIONS,
    endPos,
    getState,
    isBlock,
    isUnbreakable,
    isVisible,
    leftPos,
    moveMergedNodes,
    nodeSize,
    prepareUpdate,
    setCursor,
    splitTextNode,
} from "../utils/utils.js";

Text.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    const parentNode = this.parentNode;

    if (!offset) {
        // Backspace at the beginning of a text node is not a specific case to
        // handle, let the element implementation handle it.
        HTMLElement.prototype.oDeleteBackward.call(this, offset, alreadyMoved);
        return;
    }

    // First, split around the character where the backspace occurs
    const firstSplitOffset = splitTextNode(this, offset);
    const middleNode = parentNode.childNodes[firstSplitOffset - 1];
    const secondSplitOffset = splitTextNode(middleNode, middleNode.length - 1);

    // Get the left state at the first split location so that we know if the
    // backspace must propagate after the character removal.
    const {ctGroup: leftCTGroup} = getState(parentNode, firstSplitOffset, DIRECTIONS.LEFT);

    // Do remove the character, then restore the state of the surrounding parts.
    const restore = prepareUpdate(parentNode, secondSplitOffset, parentNode, firstSplitOffset);
    middleNode.remove();
    restore();

    // If the removed element was not visible content, propagate the backspace.
    if (leftCTGroup === CTGROUPS.BLOCK || leftCTGroup === CTGROUPS.BR) {
        parentNode.oDeleteBackward(secondSplitOffset, alreadyMoved);
        return;
    }

    setCursor(parentNode, secondSplitOffset);
};

HTMLElement.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    let moveDest;

    if (offset) {
        const leftNode = this.childNodes[offset - 1];
        if (!isBlock(leftNode)) {
            /**
             * Backspace just after an inline node, convert to backspace at the
             * end of that inline node.
             *
             * E.g. <p>abc<i>def</i>[]</p> + BACKSPACE
             * <=>  <p>abc<i>def[]</i></p> + BACKSPACE
             */
            leftNode.oDeleteBackward(nodeSize(leftNode), alreadyMoved);
            return;
        }

        /**
         * Backspace just after an block node, we have to move any inline
         * content after it, up to the next block. If the cursor is between
         * two blocks, this is a theoretical case: just do nothing.
         *
         * E.g. <p>abc</p>[]de<i>f</i><p>ghi</p> + BACKSPACE
         * <=>  <p>abcde<i>f</i></p><p>ghi</p>
         */
        alreadyMoved = true;
        moveDest = endPos(leftNode);
    } else {
        const parentEl = this.parentNode;

        if (isUnbreakable(this)
                || isUnbreakable(parentEl) && parentEl.childNodes.length === 1 && parentEl.firstChild === this) {
            // TODO review that logic, it made sense when AGE explained it but
            // then they have an opposite test which removes the last p if there
            // is surrounding text node ab<p>[]cd</p> should apparently drop the
            // p but not if there is no ab...
            return;
        }

        if (!isBlock(this)) {
            /**
             * Backspace at the beginning of an inline node, nothing has to be
             * done: propagate the backspace. If the node was empty, we remove
             * it before.
             *
             * E.g. <p>abc<b></b><i>[]def</i></p> + BACKSPACE
             * <=>  <p>abc<b>[]</b><i>def</i></p> + BACKSPACE
             * <=>  <p>abc[]<i>def</i></p> + BACKSPACE
             */
            const parentOffset = childNodeIndex(this);
            if (!nodeSize(this)) {
                const visible = isVisible(this);

                const restore = prepareUpdate(...boundariesOut(this));
                this.remove();
                restore();

                if (visible) {
                    // TODO this handle BR/IMG/etc removals../ to see if we
                    // prefer to have a dedicated handler for every possible
                    // HTML element or if we let this generic code handle it.
                    setCursor(parentEl, parentOffset); // FIXME should probably get the first inline in the LEFT direction, just like moveMergeNodes
                    return;
                }
            }
            parentEl.oDeleteBackward(parentOffset, alreadyMoved);
            return;
        }

        /**
         * Backspace at the beginning of a block node, we have to move the
         * inline content at its beginning outside of the element and propagate
         * to the left block if any.
         *
         * E.g. (prev == block)
         *      <p>abc</p><div>[]def<p>ghi</p></div> + BACKSPACE
         * <=>  <p>abc</p>[]def<div><p>ghi</p></div> + BACKSPACE
         *
         * E.g. (prev != block)
         *      abc<div>[]def<p>ghi</p></div> + BACKSPACE
         * <=>  abc[]def<div><p>ghi</p></div>
         */
        moveDest = leftPos(this);
    }

    let node = this.childNodes[offset];
    let firstBlockIndex = offset;
    while (node && !isBlock(node)) {
        node = node.nextSibling;
        firstBlockIndex++;
    }
    let [cursorNode, cursorOffset] = moveMergedNodes(...moveDest, this, offset, firstBlockIndex);

    // Propagate if this is still a block on the left of where the nodes were
    // moved.
    if (cursorNode.nodeType === Node.TEXT_NODE && cursorOffset === 0) {
        cursorOffset = childNodeIndex(cursorNode);
        cursorNode = cursorNode.parentNode;
    }
    if (cursorNode.nodeType !== Node.TEXT_NODE) {
        const {ctGroup, cType} = getState(cursorNode, cursorOffset, DIRECTIONS.LEFT);
        if (ctGroup === CTGROUPS.BLOCK && (!alreadyMoved || cType === CTYPES.BLOCK_OUTSIDE)) {
            cursorNode.oDeleteBackward(cursorOffset, alreadyMoved);
        }
    }
};

HTMLLIElement.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    // FIXME On Firefox, backspace in LI at offset 0 is not detected if the LI
    // still contains text as contentEditable does nothing so no 'input' event
    // is fired and nothing can be rollbacked: how to handle that ??

    if (offset > 0 || this.previousElementSibling) {
        // If backspace inside li content or if the li is not the first one,
        // it behaves just like in a normal element.
        HTMLElement.prototype.oDeleteBackward.call(this, offset, alreadyMoved);
        return;
    }
    this.oShiftTab(offset);
};
