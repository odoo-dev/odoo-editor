"use strict";

import {
    setCursorEnd,
    splitTextSimple,
    blockify
} from "../utils/utils.js";

Text.prototype.oShiftEnter = function (offset) {
    this.parentElement.oShiftEnter(splitTextSimple(this, offset));
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    const brEl = document.createElement('BR');
    if (offset >= this.childNodes.length) {
        this.appendChild(brEl);
    } else {
        this.insertBefore(brEl, this.childNodes[offset]);
    }
    blockify(brEl);
    setCursorEnd(brEl);
};
