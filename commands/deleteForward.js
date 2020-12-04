"use strict";

import {
    childNodeIndex,
    findNext,
    findNextInline,
    findVisibleTextNextNode,
    isContentTextNode,
    isVisibleEmpty,
} from "../utils/utils.js";

Text.prototype.oDeleteForward = function (offset) {
    if (offset < this.length) {
        this.oDeleteBackward(offset + 1);
    } else {
        HTMLElement.prototype.oDeleteForward.call(this.parentNode, childNodeIndex(this) + 1);
    }
};

HTMLElement.prototype.oDeleteForward = function (offset) {
    const nextVisibleText = findVisibleTextNextNode(this, offset);
    if (nextVisibleText) {
        nextVisibleText.oDeleteBackward(1);
        return;
    }

    const nextVisibleEmptyEl = findNextInline(this, offset, node => isVisibleEmpty(node));
    if (nextVisibleEmptyEl) {
        nextVisibleEmptyEl.parentNode.oDeleteBackward(childNodeIndex(nextVisibleEmptyEl) + 1);
        return;
    }

    const nextVisibleTextOutOfBlock = findNext(this, offset, node => isContentTextNode(node));
    if (nextVisibleTextOutOfBlock) {
        nextVisibleTextOutOfBlock.oDeleteBackward(0);
        return;
    }
};
