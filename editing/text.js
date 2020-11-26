"use strict";

import {
    childNodeIndex, splitText,
    setCursor, setCursorEnd, isBlock, isInvisible, isSpace, hasForwardChar,
    hasBackwardVisibleSpace, hasForwardVisibleSpace, latestChild
} from "../utils/utils.js";

// TextNode

function baseTextEnter(offset) {
    let parentOffset = childNodeIndex(this);

    if (offset > 0) {
        parentOffset++;

        if (offset < this.length) {
            splitText(this, offset);
        }
    }

    return parentOffset;
}

Text.prototype.oShiftEnter = function (offset) {
    this.parentElement.oShiftEnter(baseTextEnter.call(this, offset), true);
};

Text.prototype.oEnter = function (offset) {
    this.parentElement.oEnter(baseTextEnter.call(this, offset), true);
};

Text.prototype.oDeleteBackward = function (offset) {
    console.log('oDeleteBackward Text');
    let space = false;
    let value = this.nodeValue;
    if (offset === undefined) {
        offset = offset || value.length;
    }
    let from = offset - 1;

    // remove zero-width characters
    while (isInvisible(value.charAt(from))) {
        from--;
    }
    while (isInvisible(value.charAt(offset))) {
        offset++;
    }
    if (from < 0) {
        this.nodeValue = value.substring(offset);
        return HTMLElement.prototype.oDeleteBackward.call(this);
    }

    // if char is space, remove multiple spaces: <p>abc   []</p>
    space = isSpace(value.charAt(from));
    if (space) {
        while (from && (isSpace(value.charAt(from - 1)) || isInvisible(value.charAt(from - 1)))) {
            from--;
        }
        // TODO: increase offset for this use case ___[]___
    }
    this.nodeValue = value.substring(0, from) + value.substring(offset);

    // adapt space into &nbsp; and vice-versa, depending on context
    let left = value.substring(0, from).replace(/\s+/, '');
    let right = value.substring(offset).replace(/\s+/, '');
    let leftSpace = hasBackwardVisibleSpace(this);
    let rightSpace = hasForwardVisibleSpace(this);
    if (!from) {
        if (space) { // _</b>_[]  or  </p>_[]
            return this.oDeleteBackward(0);
        }
        if (!space && !leftSpace) { // </p>a[]_
            this.nodeValue = this.nodeValue.replace(/^\s+/, '\u00A0');
        }
        if (!space && leftSpace) { // _</b>a[]_
            leftSpace.nodeValue = leftSpace.nodeValue.replace(/\s+$/, '\u00A0');
        }
    } else if (!right) {
        if (space && rightSpace) { // _[]</b>_
            return this.oDeleteBackward();
        }
        if (!space && !rightSpace) { // a_a[]</p>   || <p>___a[]_</p>
            if (left || leftSpace) {
                this.nodeValue = this.nodeValue.replace(/\s+$/, '\u00A0');
            }
        }
    } else {
        if (!right && !space) { // _a[]_</b>
            this.nodeValue = value.substring(0, from).replace(/\s+$/, '\u00A0') + value.substring(offset);
        }
        if (!left && !space) { // </p>_a[]_
            this.nodeValue = value.substring(0, from) + value.substring(offset).replace(/^\s+/, '\u00A0');
        }
    }

    // // TODO: move this to utils?
    // add a <br> if necessary: double a preceeding one, or inside an empty block
    if (!this.nodeValue.replace(/\s+/, '') && !hasForwardChar(this)) {
        let node = this;
        do {
            if (node.previousSibling) {
                node = latestChild(node.previousSibling);
                if (node.tagName === "BR") {
                    node.before(document.createElement('BR'));
                    break;
                }
            } else {
                node = node.parentElement;
                if (isBlock(node)) {
                    node.append(document.createElement('BR'));
                    break;
                }
            }
        } while (!isBlock(node) && !(node.nodeType === Node.TEXT_NODE && node.nodeValue.replace(/\s+/, '')));
    }
    setCursor(this, Math.min(from, this.nodeValue.length));
};

Text.prototype.oMove = function (src) {
    this.nodeValue = this.nodeValue.replace(/\s+$/, '');
    if (!this.nodeValue) {
        return (this.previousSibling || this.parentElement).oMove(src);
    }
    setCursorEnd(this);
    if (isBlock(src)) {
        while (src.firstChild) {
            this.after(src.firstChild);
        }
        src.remove();
    } else {
        let node = src;
        while (node && !isBlock(node)) {
            this.after(node);
            node = node.nextSibling;
        }
    }
    // setCursorEnd(this);
};

Text.prototype.oTab = function (offset) {
    return this.parentElement.oTab(0);
};

Text.prototype.oShiftTab = function (offset) {
    return this.parentElement.oShiftTab(0);
};
