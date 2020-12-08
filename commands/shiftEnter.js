"use strict";

import {
    changeNode,
    setCursor,
    splitText,
    isFakeLineBreak,
} from "../utils/utils.js";

Text.prototype.oShiftEnter = function (offset) {
    this.parentElement.oShiftEnter(splitText(this, offset));
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    let [leftCb, rightCb] = changeNode(this, offset);
    const brEl = document.createElement('BR');
    if (offset >= this.childNodes.length) {
        this.appendChild(brEl);
    } else {
        this.insertBefore(brEl, this.childNodes[offset]);
    }
    if (isFakeLineBreak(brEl)) {
        brEl.before(document.createElement('BR'));
    }
    leftCb();
    rightCb();
    setCursor(brEl);
};
