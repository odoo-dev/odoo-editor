"use strict";

import {
    isBlock,
    setCursorStart,
} from "../utils/utils.js";

Text.prototype.oShiftTab = function (offset) {
    return this.parentElement.oShiftTab(0);
};

HTMLElement.prototype.oShiftTab = function (offset = undefined) {
    if (!isBlock(this)) {
        return this.parentElement.oShiftTab(offset);
    }
    return false;
};

HTMLLIElement.prototype.oShiftTab = function (offset) {
    let li = this;
    if (li.nextElementSibling) {
        let ul = document.createElement("ul");
        while (li.nextSibling) {
            ul.append(li.nextSibling);
        }
        if (li.parentNode.parentNode.tagName === 'LI') {
            let lip = document.createElement("li");
            lip.append(ul);
            lip.style.listStyle = "none";
            li.parentNode.parentNode.after(lip);
        } else {
            li.parentNode.after(ul);
        }
    }

    if (li.parentNode.parentNode.tagName === 'LI') {
        let toremove = !li.previousElementSibling ? li.parentNode.parentNode : null;
        li.parentNode.parentNode.after(li);
        if (toremove) {
            toremove.remove();
        }
        setCursorStart(li);
    } else {
        let ul = li.parentNode;
        let p = document.createElement('P');
        while (li.firstChild) {
            p.append(li.firstChild);
        }
        li.parentNode.after(p);
        li.remove();
        if (!ul.firstElementChild) {
            ul.remove();
        }
        setCursorStart(p);
    }
    return true;
};
