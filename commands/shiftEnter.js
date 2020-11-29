"use strict";

import {
    splitText,
} from "../utils/utils.js";

Text.prototype.oShiftEnter = function (offset) {
    this.parentElement.oShiftEnter(splitText(this, offset), true);
};

HTMLElement.prototype.oShiftEnter = function (offset) {
    const brEl = document.createElement('BR'); // TODO check the addBr function ?
    if (offset >= this.childNodes.length) {
        this.appendChild(brEl);
    } else {
        this.insertBefore(brEl, this.childNodes[offset]);
    }
};
