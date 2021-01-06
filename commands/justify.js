"use strict";

import {
    childNodeIndex,
    isBlock,
} from "../utils/utils.js";


Text.prototype.oJustify = function (offset, mode) {
    this.parentElement.oJustify(childNodeIndex(this), mode);
};
/**
 * This does not check for command state 
 * @param {*} offset 
 * @param {*} mode 'left', 'right', 'center' or 'justify'
 */
HTMLElement.prototype.oJustify = function (offset, mode) {
    if (!isBlock(this)) {
        return this.parentElement.oJustify(childNodeIndex(this), mode);
    }
    this.style.textAlign = mode;
};
