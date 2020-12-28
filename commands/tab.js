"use strict";

import {
    createList,
    getListMode,
    isBlock,
    setCursorStart,
    preserveCursor,
    toggleClass,
} from "../utils/utils.js";

Text.prototype.oTab = function (offset) {
    return this.parentElement.oTab(0);
};

HTMLElement.prototype.oTab = function (offset) {
    if (!isBlock(this)) {
        return this.parentElement.oTab(offset);
    }
    return false;
};

HTMLLIElement.prototype.oTab = function (offset) {
    let lip = document.createElement("li");
    let ul = createList(getListMode(this.closest('ul, ol')));

    // TODO: improve DOM structure by joining same level sibling (oShiftTab already supports it)

    lip.append(ul);

    const cr = preserveCursor();
    toggleClass(lip, 'nested');
    this.before(lip);
    ul.append(this);
    cr();
    return true;
};
