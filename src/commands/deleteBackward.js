import { isEmptyBlock, UNBREAKABLE_ROLLBACK_CODE, UNREMOVABLE_ROLLBACK_CODE } from '../editor.js';
import {
    boundariesOut,
    childNodeIndex,
    CTGROUPS,
    CTYPES,
    DIRECTIONS,
    endPos,
    fillEmpty,
    getState,
    isBlock,
    isInPre,
    isUnremovable,
    isVisible,
    isVisibleStr,
    leftPos,
    moveNodes,
    nodeSize,
    prepareUpdate,
    setCursor,
    splitTextNode,
    isUnbreakable,
    isMediaElement,
    isVisibleEmpty,
} from '../utils/utils.js';

Text.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    console.log('        text oDeleteBackward', offset, this);
    const parentNode = this.parentNode;

    if (!offset) {
        // Backspace at the beginning of a text node is not a specific case to
        // handle, let the element implementation handle it.
        HTMLElement.prototype.oDeleteBackward.call(this, offset, alreadyMoved);
        return;
    }

    // First, split around the character where the backspace occurs
    const firstSplitOffset = splitTextNode(this, offset - 1);
    const secondSplitOffset = splitTextNode(parentNode.childNodes[firstSplitOffset], 1);
    const middleNode = parentNode.childNodes[firstSplitOffset];

    // Do remove the character, then restore the state of the surrounding parts.
    const restore = prepareUpdate(parentNode, firstSplitOffset, parentNode, secondSplitOffset);
    const isSpace = !isVisibleStr(middleNode) && !isInPre(middleNode);
    middleNode.remove();
    restore();

    // If the removed element was not visible content, propagate the backspace.
    if (
        isSpace &&
        getState(parentNode, firstSplitOffset, DIRECTIONS.LEFT).cType !== CTYPES.CONTENT
    ) {
        parentNode.oDeleteBackward(firstSplitOffset, alreadyMoved);
        return;
    }

    fillEmpty(parentNode);
    setCursor(parentNode, firstSplitOffset);
};

HTMLElement.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    console.log('        element oDeleteBackward', offset);
    console.log(this, this?.tagName);
    let moveDest;
    if (offset) {
        console.log('           #00X');
        const leftNode = this.childNodes[offset - 1];
        if (isUnremovable(leftNode)) {
            console.log('           #00X - 001');
            throw UNREMOVABLE_ROLLBACK_CODE;
        }
        // if (isUnbreakable(leftNode)) {
        //     console.log('           #00X - 002');
        //     throw UNBREAKABLE_ROLLBACK_CODE;
        // }
        if (isMediaElement(leftNode)) {
            console.log('           #00X - 003');
            leftNode.remove();
            return;
        }
        if (!isBlock(leftNode) || isVisibleEmpty(leftNode)) {
            console.log('           #00X - 004');
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
        console.log('#00X - 005');
        alreadyMoved = true;
        moveDest = endPos(leftNode);
    } else {
        console.log('#00Y');
        if (isUnremovable(this)) {
            throw UNREMOVABLE_ROLLBACK_CODE;
        }
        const parentEl = this.parentNode;

        if (!isBlock(this) || isVisibleEmpty(this)) {
            console.log('---> inside isblock isvisiblemepty check');
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

                fillEmpty(parentEl);

                if (visible) {
                    // TODO this handle BR/IMG/etc removals../ to see if we
                    // prefer to have a dedicated handler for every possible
                    // HTML element or if we let this generic code handle it.
                    setCursor(parentEl, parentOffset);
                    return;
                }
            }
            parentEl.oDeleteBackward(parentOffset, alreadyMoved);
            return;
        }
        // else if (isEmptyBlock(this)) {
        //     console.log('---> new remove');
        //     // const previousSibling = this.previousSibling;
        //     // console.log('previousSibling', previousSibling);
        //     // console.log('childlist', parentEl.childNodes);
        //     // const parentOffset = childNodeIndex(this);
        //     this.remove();
        //     // setCursor(parentEl, parentOffset - 1, undefined, undefined, false);
        //     return;
        // }

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
    console.log('#1');
    let node = this.childNodes[offset];
    console.log('#1', node);
    let firstBlockIndex = offset;
    while (node && !isBlock(node)) {
        console.log('#1.1');
        node = node.nextSibling;
        firstBlockIndex++;
    }
    let [cursorNode, cursorOffset] = moveNodes(...moveDest, this, offset, firstBlockIndex);
    setCursor(cursorNode, cursorOffset);

    // Propagate if this is still a block on the left of where the nodes were
    // moved.
    console.log('#2', node);
    if (
        cursorNode.nodeType === Node.TEXT_NODE &&
        (cursorOffset === 0 || cursorOffset === cursorNode.length)
    ) {
        console.log('#2.1');
        cursorOffset = childNodeIndex(cursorNode) + (cursorOffset === 0 ? 0 : 1);
        cursorNode = cursorNode.parentNode;
    }
    if (cursorNode.nodeType !== Node.TEXT_NODE) {
        console.log('#2.2');
        const { cType } = getState(cursorNode, cursorOffset, DIRECTIONS.LEFT);
        if (cType & CTGROUPS.BLOCK && (!alreadyMoved || cType === CTYPES.BLOCK_OUTSIDE)) {
            console.log('#2.2.1');
            cursorNode.oDeleteBackward(cursorOffset, alreadyMoved);
        }
    }
};

HTMLLIElement.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    if (offset > 0 || this.previousElementSibling) {
        // If backspace inside li content or if the li is not the first one,
        // it behaves just like in a normal element.
        HTMLElement.prototype.oDeleteBackward.call(this, offset, alreadyMoved);
        return;
    }
    this.oShiftTab(offset);
};

HTMLBRElement.prototype.oDeleteBackward = function (offset, alreadyMoved = false) {
    const parentOffset = childNodeIndex(this);
    const rightState = getState(this.parentElement, parentOffset + 1, DIRECTIONS.RIGHT).cType;
    if (rightState & CTYPES.BLOCK_INSIDE) {
        this.parentElement.oDeleteBackward(parentOffset, alreadyMoved);
    } else {
        HTMLElement.prototype.oDeleteBackward.call(this, offset, alreadyMoved);
    }
};
