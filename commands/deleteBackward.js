"use strict";

import {
    childNodeIndex,
    isBlock,
    setCursor,
    splitTextNode,
    replacePreviousSpace,
    updateNodeLeft,
    updateNodeRight,
    getLeftState,
    previousNode,
    nextNode,
} from "../utils/utils.js";


Text.prototype.oDeleteBackward = function (offset) {
    const parentOffset = childNodeIndex(this);
    if (!offset) {
        return this.parentElement.oDeleteBackward(parentOffset);
    }

    let middle = splitTextNode(this, offset);
    let rightCb = updateNodeLeft(this);

    let leftState = getLeftState(middle);

    replacePreviousSpace(middle);
    if (leftState=='space') 
        return true;

    if (leftState=='block' || (!middle.length))
        return this.parentElement.oDeleteBackward(parentOffset);

    let left = splitTextNode(middle, middle.length-1);
    let leftCb = updateNodeRight(left);
    middle.remove();
    rightCb();
    leftCb();
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

HTMLBRElement.prototype.oDeleteBackward = function (offset) {
    let cb1 = updateNodeLeft(nextNode(this));
    this.remove();
    cb1();
}


HTMLElement.prototype.oDeleteBackward = function (offset) {
    const parentOffset = childNodeIndex(this);
    const pEl = this.parentElement;
    if (offset) {
        let el = this.childNodes[offset - 1];
        if (isBlock(el)) {
            // <p>abc</p>[]de<i>f</i> + BACKSPACE   =>  <p>abcde<i>f</i>
            setCursor(el, el.childNodes.length);
            let cb1 = updateNodeRight(el.lastChild);
            while ( (this.childNodes.length>offset) && !isBlock(this.childNodes[offset]) ) {
                el.append(this.childNodes[offset]);
            }
            cb1();
            return;
        }

        // <p>abc<i>def</i>[]</p> + BACKSPACE       =>  <p>abc<i>def[]</i></p> + BACKSPACE
        el.oDeleteBackward(el.length);

    } else {

        // <p>abc</p><p>[]def</p> + BACKSPACE       => <p>abc</p>[]def + BACKSPACE  (prev == block)
        // abc<p>[]def</p> + BACKSPACE              => abc[]def                     (prev != block)
        if (isBlock(this)) {
            let leftState = getLeftState(previousNode(this));
            let cb1 = updateNodeLeft(this.firstChild);
            while (this.firstChild && !isBlock(this.firstChild))
                this.before(this.firstChild);
            if (!this.childNodes.length)
                this.remove();
            cb1();
            if (leftState!='block') {
                setCursor(pEl, parentOffset);
                return;
            }
        } else if (!this.childNodes.length) {
            this.remove();
        }

        // <p>abc<i>[]def</i></p> + BACKSPACE       => <p>abc[]<i>def</i></p> + BACKSPACE
        pEl.oDeleteBackward(parentOffset);
    }
}

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
