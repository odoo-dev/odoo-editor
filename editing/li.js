"use strict";

import {setCursor} from "../utils/utils.js";

/**
 * TODO review the whole logic of having to use oRemove instead of remove...
 */
HTMLLIElement.prototype.oRemove = function () {
    const parentEl = this.parentElement;
    this.remove();
    if (!parentEl.children.length) {
        parentEl.remove();
    }
};

HTMLLIElement.prototype.oMove = function (src) {
    let le = this.lastElementChild;
    if (le && ['UL', 'OL'].includes(le.tagName)) {
        return le.oMove(src);
    }
    return HTMLElement.prototype.oMove.call(this, src);
};

HTMLLIElement.prototype.oEnter = function () {
    // If not last list item or not empty last item, regular block split
    if (this.nextElementSibling || this.textContent) {
        return HTMLElement.prototype.oEnter.call(this, ...arguments);
    }

    // If nested LI (empty and last), shiftTab
    if (this.parentNode.closest('li')) {
        this.oShiftTab();
        return;
    }

    // Otherwise, regular list item, empty and last: convert to a paragraph
    const pEl = document.createElement('p');
    const brEl = document.createElement('br');
    pEl.appendChild(brEl);
    this.closest('ul, ol').after(pEl);
    this.oRemove();
    setTimeout(() => setCursor(pEl, 0), 0); // FIXME investigate why setTimeout needed in this case...
};

HTMLLIElement.prototype.oDeleteBackward = function (offset) {
    console.log('oDeleteBackward LI');

    // TODO this next block of code is just temporary after the "offset"
    // refactoring the other methods were adapted but not the oDeleteBackward
    // ones.
    let node = this;
    if (offset > 0) {
        node = this.childNodes[offset - 1];
        node.oDeleteBackward(node.nodeType === Node.TEXT_NODE ? node.length : undefined);
        return;
    } else {
        offset = undefined;
    }

    let target = this.previousElementSibling;
    if (target) {
        return HTMLElement.prototype.oDeleteBackward.call(this);
    }

    if (this.parentElement.parentElement.tagName === 'LI') {
        return this.oShiftTab();
    }

    target = document.createElement('p');
    this.parentElement.before(target);
    while (this.firstChild) {
        target.append(this.firstChild);
    }
    this.oRemove();
    setCursor(target.firstChild || target, 0);
};

HTMLLIElement.prototype.oTab = function (offset) {
    let lip = document.createElement("li");
    let ul = document.createElement("ul");

    // TODO: improve DOM structure by joining same level sibling (oShiftTab already supports it)

    lip.append(ul);
    lip.style.listStyle = "none";
    this.before(lip);
    ul.append(this);
    setCursor(this, 0);
    return true;
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
        setCursor(li.firstChild || li, 0);
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
        setCursor(p.firstChild || p, 0);
    }
    return true;
};
