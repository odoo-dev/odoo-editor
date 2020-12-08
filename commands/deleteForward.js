"use strict";

import {
    childNodeIndex,
    findNode,
    findVisibleTextNode,
    isContentTextNode,
    isVisibleEmpty,
    rightDeepOnlyPath,
    rightDeepOnlyInlinePath,
} from "../utils/utils.js";

Text.prototype.oDeleteForward = function (offset) {
    if (offset < this.length) {
        this.oDeleteBackward(offset + 1);
    } else {
        HTMLElement.prototype.oDeleteForward.call(this.parentNode, childNodeIndex(this) + 1);
    }
};

HTMLElement.prototype.oDeleteForward = function (offset) {
    const nextVisibleText = findVisibleTextNode(rightDeepOnlyInlinePath(this, offset));
    if (nextVisibleText) {
        nextVisibleText.oDeleteBackward(1);
        return;
    }

    const nextVisibleEmptyEl = findNode(rightDeepOnlyInlinePath(this, offset), node => isVisibleEmpty(node));
    if (nextVisibleEmptyEl) {
        nextVisibleEmptyEl.parentNode.oDeleteBackward(childNodeIndex(nextVisibleEmptyEl) + 1);
        return;
    }

    const nextVisibleTextOutOfBlock = findNode(rightDeepOnlyPath(this, offset), node => isContentTextNode(node));
    if (nextVisibleTextOutOfBlock) {
        nextVisibleTextOutOfBlock.oDeleteBackward(0);
        return;
    }
};
