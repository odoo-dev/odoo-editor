"use strict";

import {setCursor} from "../utils/utils.js";


HTMLLIElement.prototype.oRemove = function() {
    let ul = this.oParent;
    this.remove()
    if (! ul.querySelector('li'))
        ul.remove();
}

HTMLLIElement.prototype.oEnter = function(nextSibling) {
    console.log('oEnter LI');
    // if not last bullet, regular block break
    if (this.nextElementSibling || this.textContent)
        return HTMLElement.prototype.oEnter.call(this, nextSibling);

    // if nested LI, shiftTab
    if (this.parentNode.parentNode.tagName=='LI')
        return this.oShiftTab();

    // if latest LI at lowest level, convert to a paragraph
    debugger;
    let p = document.createElement('p');
    let br = document.createElement('br');
    p.append(br);
    this.closest('ul,ol').after(p);
    this.oRemove();
    setCursor(br, 0);
    return p;
}

HTMLLIElement.prototype.oDeleteBackward = function() {
    console.log('oDeleteBackward LI');
    let target = this.previousElementSibling;
    if (target)
        return HTMLElement.prototype.oDeleteBackward.call(this);

    if (this.parentElement.parentElement.tagName=='LI')
        return this.oShiftTab();

    target = document.createElement('p');
    this.oParent.before(target);
    while (this.firstChild)
        target.append(this.firstChild);
    this.oRemove();
    setCursor(target.firstChild || target, 0);
}

HTMLLIElement.prototype.oTab = function(offset) {
    let lip = document.createElement("li")
    let ul = document.createElement("ul");

    // TODO: improve DOM structure by joining same level sibling (oShiftTab already supports it)

    lip.append(ul);
    lip.style.listStyle = "none";
    this.before(lip);
    ul.append(this);
    setCursor(this, 0);
    return true;
}

HTMLLIElement.prototype.oShiftTab = function(offset) {
    let li = this;
    if (li.nextElementSibling) {
        let ul = document.createElement("ul");
        while (li.nextSibling)
            ul.append(li.nextSibling);
        if (li.parentNode.parentNode.tagName == 'LI') {
            let lip = document.createElement("li");
            lip.append(ul);
            lip.style.listStyle = "none";
            li.parentNode.parentNode.after(lip);
        } else
            li.parentNode.after(ul);
    }

    if (li.parentNode.parentNode.tagName == 'LI') {
        let toremove = (! li.previousElementSibling)?li.parentNode.parentNode:null;
        li.parentNode.parentNode.after(li);
        if (toremove) toremove.remove();
        setCursor(li.firstChild || li, 0);
    } else {
        let ul = li.parentNode;
        let p = document.createElement('P');
        while (li.firstChild)
            p.append(li.firstChild);
        li.parentNode.after(p);
        li.remove();
        if (! ul.firstElementChild) ul.remove();
        setCursor(p.firstChild || p, 0);
    }
    return true;
}


