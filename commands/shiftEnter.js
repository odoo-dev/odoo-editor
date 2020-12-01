"use strict";

import {
    blockify,
    setCursorEnd,
    splitText,
} from "../utils/utils.js";

Text.prototype.oShiftEnter = function (offset) {
    this.parentElement.oShiftEnter(splitText(this, offset));
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    blockify(this, offset);
    const brEl = document.createElement('BR');
    if (offset >= this.childNodes.length) {
        this.appendChild(brEl);
    } else {
        this.insertBefore(brEl, this.childNodes[offset]);
    }
    setCursorEnd(brEl);
};
