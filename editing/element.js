"use strict";

import {
    setCursor, setCursorEnd, isBlock, latestChild,
    isUnbreakable, fillEmpty, isInline,
} from "../utils/utils.js";

HTMLElement.prototype.oEnter = function (nextSibling) {
    console.log('oEnter Element');

    let pnode = this;
    let next = this.nextSibling;
    while (!isBlock(pnode)) {
        pnode = pnode.parentElement;
    }

    // if no block, or in an unbreackable: do a shiftEnter instead
    if (isUnbreakable(pnode)) {
        let error = new Error('unbreakable');
        throw error;
    }

    if (nextSibling || isBlock(this)) {
        next = document.createElement(this.tagName);
        while (nextSibling) {
            let oldnode = nextSibling;
            nextSibling = nextSibling.nextSibling;
            next.append(oldnode);
        }
        fillEmpty(next);
        this.after(next);
    }

    // escale only if display = inline
    if (isInline(this) && this.parentElement) {
        next = this.parentElement.oEnter(next);
    } else {
        fillEmpty(this);
    }
    setCursor(next || this, 0);
    return next;
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    let br = document.createElement('BR');
    this.before(br);
    return true;
};

HTMLElement.prototype.oDeleteBackward = function () {
    console.log('oDeleteBackward Element');
    if (isUnbreakable(this)) {
        return false;
    }
    // merge with previous block
    let node = this.previousSibling;
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

HTMLElement.prototype.oDeleteForward = function () {

};

HTMLElement.prototype.oTab = function (offset = undefined) {
    if (isInline(this)) {
        return this.parentElement.oTab(offset);
    }
    return false;
};

HTMLElement.prototype.oShiftTab = function (offset = undefined) {
    if (isInline(this)) {
        return this.parentElement.oShiftTab(offset);
    }
    return false;
};

// Element Utils

HTMLElement.prototype.oRemove = function () {
    console.log('oRemove Element');
    let pe = this.parentElement;

    this.remove();
    if (isInline(this)) {
        pe.oRemove();
    }
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
