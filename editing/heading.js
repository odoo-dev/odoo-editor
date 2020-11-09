"use strict";

import {setTagName} from "../utils/utils.js";

// Cursor end of line: <h1>title[]</h1>  --> <h1>title</h1><p>[]<br/></p>
// Cursor in the line: <h1>tit[]le</h1>  --> <h1>tit</h1><h1>[]le</h1>
HTMLHeadingElement.prototype.oEnter = function(nextSibling) {
    console.log('oEnter Heading');
    let new_el = HTMLElement.prototype.oEnter.call(this, nextSibling);
    if (!new_el.textContent)
        new_el = setTagName(new_el, 'P');
    return new_el;
}


