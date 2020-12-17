"use strict";

import {
    isBlock,
    setCursorStart,
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
    let ul = document.createElement("ul");

    // TODO: improve DOM structure by joining same level sibling (oShiftTab already supports it)

    lip.append(ul);
    lip.style.listStyle = "none";
    this.before(lip);
    ul.append(this);
    setCursorStart(this);
    return true;
};
