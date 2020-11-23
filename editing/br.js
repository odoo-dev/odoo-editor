"use strict";
import {hasForwardChar} from "../utils/utils.js";

HTMLBRElement.prototype.oDeleteBackward = function () {
    // propagate delete if we removed an invisible <br/>
    if (!hasForwardChar(this)) {
        (this.previousSibling || this.parentElement).oDeleteBackward();
    }
    this.remove();
};

HTMLBRElement.prototype.oMove = function (src) {
    this.remove();
};
