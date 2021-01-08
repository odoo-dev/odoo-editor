import { childNodeIndex, isBlock } from '../utils/utils.js';

Text.prototype.oAlign = function (offset, mode) {
    this.parentElement.oAlign(childNodeIndex(this), mode);
};
/**
 * This does not check for command state
 * @param {*} offset
 * @param {*} mode 'left', 'right', 'center' or 'justify'
 */
HTMLElement.prototype.oAlign = function (offset, mode) {
    if (!isBlock(this)) {
        return this.parentElement.oAlign(childNodeIndex(this), mode);
    }
    this.style.textAlign = mode;
};
