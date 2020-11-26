"use strict";

import {setTagName} from "../utils/utils.js";

/**
 * Specific behavior for headings: do not split in two if cursor at the end but
 * instead create a paragraph.
 * Cursor end of line: <h1>title[]</h1> + ENTER <=> <h1>title</h1><p>[]<br/></p>
 * Cursor in the line: <h1>tit[]le</h1> + ENTER <=> <h1>tit</h1><h1>[]le</h1>
 */
HTMLHeadingElement.prototype.oEnter = function () {
    HTMLElement.prototype.oEnter.call(this, ...arguments);
    const newEl = this.nextSibling;
    if (!newEl.textContent) {
        setTagName(newEl, 'P');
    }
};
