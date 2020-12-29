"use strict";

import { setCursor } from "../utils/utils.js";

Text.prototype.oCreateLink = function (offset, content) {
    let sel = document.defaultView.getSelection();
    if (content != undefined) {
        sel.deleteFromDocument();
    }
    if (sel.isCollapsed) {
        const range = document.createRange();
        range.setStart(sel.anchorNode, sel.anchorOffset);
        range.insertNode(document.createTextNode(content != undefined ? content : 'x'));
        sel.removeAllRanges();
        sel.addRange(range);
        const contentLength = content ? content.length : 0;
        setCursor(range.anchorNode, sel.anchorOffset + contentLength, sel.focusNode, sel.focusOffset);
    }
    document.execCommand('createLink', false, '#');
    sel.collapseToEnd();
};
