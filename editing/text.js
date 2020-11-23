"use strict";

import {
    setCursor, setCursorEnd, addBr, isBlock, isInvisible, isSpace, hasForwardChar,
    hasBackwardVisibleSpace, hasForwardVisibleSpace, latestChild
} from "../utils/utils.js";

// TextNode

Text.prototype.oShiftEnter = function (offset) {
    if (! offset) {
        let br = document.createElement('BR');
        this.before(br);
    } else if (offset >= this.length) {
        addBr(this);
    } else {
        let newval = this.nodeValue.substring(0, offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        addBr(newText);
        setCursor(this, 0);
    }
    return true;
};

Text.prototype.oEnter = function (offset) {
    console.log('oEnter Text');
    // check if the next block is unbreackable: rollback will do a shiftEnter instead
    let pnode = this;
    while (!isBlock(pnode)) {
        pnode = pnode.parentElement;
    }

    if (!offset) {
        this.parentElement.oEnter(this);
    } else if (offset >= this.length) {
        let el = this.parentElement.oEnter(this.nextSibling);
        setCursor(el, 0);
        return true;
    } else {
        let newval = this.nodeValue.substring(0, offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        this.parentElement.oEnter(this);
    }
    setCursor(this, 0);
};

Text.prototype.oDeleteBackward = function (offset = undefined) {
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
    let left = value.substring(0, from).replace(/[ \t\r\n]+/, '');
    let right = value.substring(offset).replace(/[ \t\r\n]+/, '');
    let leftSpace = hasBackwardVisibleSpace(this);
    let rightSpace = hasForwardVisibleSpace(this);
    if (!from) {
        if (space) { // _</b>_[]  or  </p>_[]
            return this.oDeleteBackward(0);
        }
        if (!space && !leftSpace) { // </p>a[]_
            this.nodeValue = this.nodeValue.replace(/^[ \t\r\n]+/, '\u00A0');
        }
        if (!space && leftSpace) { // _</b>a[]_
            leftSpace.nodeValue = leftSpace.nodeValue.replace(/[ \t\r\n]+$/, '\u00A0');
        }
    } else if (!right) {
        if (space && rightSpace) { // _[]</b>_
            return this.oDeleteBackward();
        }
        if (!space && !rightSpace) { // a_a[]</p>   || <p>___a[]_</p>
            if (left || leftSpace) {
                this.nodeValue = this.nodeValue.replace(/[ \t\r\n]+$/, '\u00A0');
            }
        }
    } else {
        if (!right && !space) { // _a[]_</b>
            this.nodeValue = value.substring(0, from).replace(/[ \t\r\n]+$/, '\u00A0') + value.substring(offset);
        }
        if (!left && !space) { // </p>_a[]_
            this.nodeValue = value.substring(0, from) + value.substring(offset).replace(/^[ \t\r\n]+/, '\u00A0');
        }
    }

    // // TODO: move this to utils?
    // add a <br> if necessary: double a preceeding one, or inside an empty block
    if (!this.nodeValue.replace(/[ \t\r\n]+/, '') && !hasForwardChar(this)) {
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
        } while (!isBlock(node) && !(node.nodeType === Node.TEXT_NODE && node.nodeValue.replace(/[ \t\r\n]+/, '')));
    }
    setCursor(this, Math.min(from, this.nodeValue.length));
};

Text.prototype.oMove = function (src) {
    this.nodeValue = this.nodeValue.replace(/[ \t\r\n]+$/, '');
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
