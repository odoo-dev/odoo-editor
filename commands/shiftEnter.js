"use strict";

import {
    blockify,
    setCursorEnd,
    splitText,
    isFakeLineBreak,
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
    if (isFakeLineBreak(brEl))
        brEl.before(document.createElement('BR'));
    setCursorEnd(brEl);
};
