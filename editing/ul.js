"use strict";

HTMLUListElement.prototype.oMove = function(src) {
    let li = this.lastElementChild;
    if (! li) {
        li = document.createElement('li');
        this.append(li);
    }
    li.oMove(src);
}

HTMLOListElement.prototype.oMove = HTMLUListElement.prototype.oMove;
