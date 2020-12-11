"use strict";

import {
    childNodeIndex,
    DIRECTIONS,
    getState,
    isBlock,
    isUnbreakable,
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

HTMLBRElement.prototype.oDeleteBackward = function (offset) {
    const parentOffset = childNodeIndex(this);
    const restoreLeft = prepareUpdate(this.parentElement, parentOffset+1, DIRECTIONS.LEFT);
    const restoreRight = prepareUpdate(this.parentElement, parentOffset, DIRECTIONS.RIGHT);
    this.remove();
    restoreLeft();
    restoreRight();
}


HTMLElement.prototype.oDeleteBackward = function (offset) {
    const parentOffset = childNodeIndex(this);
    let moveDest;
    let moveMethod;

    if (offset) {
        let el = this.childNodes[offset - 1];
        if (! isBlock(el)) {
            // <p>abc<i>def</i>[]</p> + BACKSPACE       =>  <p>abc<i>def[]</i></p> + BACKSPACE
            return el.oDeleteBackward(el.length);
        }

        // <p>abc</p>[]de<i>f</i> + BACKSPACE   =>  <p>abcde<i>f</i>
        moveDest = [el, el.childNodes.length];
        moveMethod = el.append.bind(el);

    } else {
        if (!isBlock(this)) {
            // <p>abc<i>[]def</i></p> + BACKSPACE       => <p>abc[]<i>def</i></p> + BACKSPACE
            if (!this.childNodes.length)
                this.remove();
            return this.parentElement.oDeleteBackward(parentOffset);
        }

        // <p>abc</p><p>[]def</p> + BACKSPACE       => <p>abc</p>[]def + BACKSPACE  (prev == block)
        // abc<p>[]def</p> + BACKSPACE              => abc[]def                     (prev != block)
        moveDest = [this.parentElement, parentOffset];
        moveMethod = this.before.bind(this);
    }

    let restoreLeft = prepareUpdate(this, offset, DIRECTIONS.RIGHT);
    let restoreRight = prepareUpdate(...moveDest, DIRECTIONS.LEFT);
    setCursor(...moveDest)

    while ( (this.childNodes.length>offset) && !isBlock(this.childNodes[offset]) ) {
        moveMethod(this.childNodes[offset]);
    }

    restoreRight();
    restoreLeft();

    // propagate when block inside block
    if (getState(...moveDest, DIRECTIONS.LEFT)[0] == STATES.BLOCK) {
        moveDest[0].oDeleteBackward(moveDest[1]);
    }
    if (!this.childNodes.length)                    // improve isEmpty?
        this.remove();
}


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
