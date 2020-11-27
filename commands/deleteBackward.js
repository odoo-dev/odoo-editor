"use strict";

import {
    hasBackwardVisibleSpace,
    hasForwardChar,
    hasForwardVisibleSpace,
    isBlock,
    isInvisible,
    isSpace,
    isUnbreakable,
    latestChild,
    setCursor,
    setCursorEnd,
} from "../utils/utils.js";

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

HTMLElement.prototype.oDeleteBackward = function (offset) {
    console.log('oDeleteBackward Element');

    // TODO this next block of code is just temporary after the "offset"
    // refactoring the other methods were adapted but not the oDeleteBackward
    // ones.
    let node = this;
    if (offset > 0) {
        node = this.childNodes[offset - 1];
        node.oDeleteBackward(node.nodeType === Node.TEXT_NODE ? node.length : undefined);
        return;
    } else {
        offset = undefined;
    }

    if (isUnbreakable(this)) {
        return false;
    }
    // merge with previous block
    node = this.previousSibling;
    if (isBlock(this) || isBlock(node)) {
        node = this.previousSibling || this.parentElement;
        node.oMove(this);
        return true;
    }
    let next = latestChild(this.previousSibling) || this.parentElement;
    if (!this.textContent) {
        this.remove();
    }
    return next.oDeleteBackward();
};

HTMLBRElement.prototype.oDeleteBackward = function () {
    // propagate delete if we removed an invisible <br/>
    if (!hasForwardChar(this)) {
        (this.previousSibling || this.parentElement).oDeleteBackward();
    }
    this.remove();
};

HTMLLIElement.prototype.oDeleteBackward = function (offset) {
    console.log('oDeleteBackward LI');

    // TODO this next block of code is just temporary after the "offset"
    // refactoring the other methods were adapted but not the oDeleteBackward
    // ones.
    let node = this;
    if (offset > 0) {
        node = this.childNodes[offset - 1];
        node.oDeleteBackward(node.nodeType === Node.TEXT_NODE ? node.length : undefined);
        return;
    } else {
        offset = undefined;
    }

    let target = this.previousElementSibling;
    if (target) {
        return HTMLElement.prototype.oDeleteBackward.call(this);
    }

    if (this.parentElement.parentElement.tagName === 'LI') {
        return this.oShiftTab();
    }

    target = document.createElement('p');
    this.parentElement.before(target);
    while (this.firstChild) {
        target.append(this.firstChild);
    }
    this.oRemove();
    setCursor(target.firstChild || target, 0);
};

// Utils
// TODO review how this works, all method on prototype or all methods as utils
// but a mix of both seems strange. Maybe a wrapper jQuery-like?

/**
 * TODO review the whole logic of having to use oRemove instead of remove...
 */
HTMLElement.prototype.oRemove = function () {
    console.log('oRemove Element');
    let pe = this.parentElement;

    this.remove();
    if (!isBlock(this)) {
        pe.oRemove();
    }
};
HTMLLIElement.prototype.oRemove = function () {
    const parentEl = this.parentElement;
    this.remove();
    if (!parentEl.children.length) {
        parentEl.remove();
    }
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

HTMLElement.prototype.oMove = function (src) {
    // TODO: check is this is unBreackable
    if (isUnbreakable(src) || isUnbreakable(this)) {
        return true;
    }
    setCursorEnd(this);
    if (isBlock(src)) {
        let node = latestChild(this);
        // remove invisible stuff until block or text content found
        while (!isBlock(node) && !(node.nodeType === Node.TEXT_NODE && (node.nodeValue.replace(/[ \n\t\r]/, '')))) {
            let old = node;
            node = latestChild(node.previousSibling) || node.parentNode;
            old.remove();
        }
        while (src.firstChild) {
            this.append(src.firstChild);
        }
        src.remove();
     } else {
        let node = src;
        while (node && !isBlock(node)) {
            let next = node.nextSibling;
            this.append(node);
            node = next;
        }
    }
    // setCursorEnd(this);
};

HTMLBRElement.prototype.oMove = function (src) {
    this.remove();
};

HTMLUListElement.prototype.oMove = function (src) {
    let li = this.lastElementChild;
    if (!li) {
        li = document.createElement('li');
        this.append(li);
    }
    li.oMove(src);
};

HTMLOListElement.prototype.oMove = HTMLUListElement.prototype.oMove;

HTMLLIElement.prototype.oMove = function (src) {
    let le = this.lastElementChild;
    if (le && ['UL', 'OL'].includes(le.tagName)) {
        return le.oMove(src);
    }
    return HTMLElement.prototype.oMove.call(this, src);
};
