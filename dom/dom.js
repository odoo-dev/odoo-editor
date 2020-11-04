
function cursorSet(node, offset) {
    let sel = document.defaultView.getSelection();
    let range = new Range();
    range.setStart(node, Math.max(offset,0));
    range.setEnd(node, Math.max(offset,0));
    sel.removeAllRanges();
    sel.addRange(range);
}

function fillEmpty(node) {
     if (node && (! node.innerText) && !node.children.length)
         node.append(document.createElement('br'));
}

// Element Keys

HTMLElement.prototype.oEnter = function(nextSibling) {
    console.log('oBreak Element');
    let style = window.getComputedStyle(this).display;
    let new_el = document.createElement(this.tagName);

    while (nextSibling) {
        let oldnode = nextSibling;
        nextSibling = nextSibling.nextSibling;
        new_el.append(oldnode);
    }
    fillEmpty(new_el);
    this.after(new_el)

    // escale only if display = inline
    if (['inline', 'inline-block'].includes(style)) {
        this.parentElement.oEnter(new_el);
    } else {
        fillEmpty(this);
    }
    cursorSet(new_el, 0);
    return new_el;
}

HTMLElement.prototype.oDelete = function() {
    console.log('oDelete Element');
    let style = window.getComputedStyle(this).display;
    let node;

    if (['inline', 'inline-block'].includes(style)) {
        node = this.previousSibling;
        if (node) {
            while (node.lastChild)
                node = node.lastChild;
        } else
            node = this.parentElement;
        return node.oDelete();
    }

    // merge with preceeding block
    node = this.previousElementSibling || this.parentElement;
    node.oMove(this)
}

HTMLElement.prototype.oTab = function(offset=undefined) {
    let style = window.getComputedStyle(this).display;
    if (['inline', 'inline-block'].includes(style))
        return this.parentElement.oTab(offset);
    return false;
};

HTMLElement.prototype.oShiftTab = function(offset=undefined) {
    let style = window.getComputedStyle(this).display;
    if (['inline', 'inline-block'].includes(style))
        return this.parentElement.oShiftTab(offset);
    return false;
};

// Element Utils

HTMLElement.prototype.oRemove = function() {
    console.log('oRemove Element');
    let style = window.getComputedStyle(this).display;
    let pe = this.parentElement;

    this.remove();
    if (['inline', 'inline-block'].includes(style))
        pe.oRemove();
}

HTMLElement.prototype.oMove = function(src) {
    while (src.firstChild)
        this.append(src.firstChild);
    src.remove();
}

// UL

HTMLUListElement.prototype.oMove = function(src) {
    let li = this.lastElementChild;
    if (! li) {
        li = document.createElement('li');
        this.append(li);
    }
    li.oMove(src);
}

// LI

HTMLLIElement.prototype.oRemove = function() {
    let ul = this.parentElement;
    this.remove()
    if (! ul.querySelector('li'))
        ul.remove();
}

HTMLLIElement.prototype.oEnter = function(nextSibling) {
    console.log('oBreak LI');
    if (this.nextElementSibling || this.textContent)
        return HTMLElement.prototype.oEnter.call(this, nextSibling);

    // enter at last li: should remove the <ll> and create an empty paragraph
    let p = document.createElement('p');
    let br = document.createElement('br');
    p.append(bt);
    this.closest('ul,ol').after(p);
    this.oRemove();
    cursorSet(p, 0);
    return p;
}

HTMLLIElement.prototype.oDelete = function() {
    console.log('oDelete LI');
    let target = this.previousElementSibling;
    if (! target) {
        target = document.createElement('p');
        this.parentElement.before(target);
    }
    while (this.firstChild)
        target.append(this.firstChild);
    this.oRemove();
}

HTMLLIElement.prototype.oTab = function(offset) {
    let lip = document.createElement("li")
    let ul = document.createElement("ul");

    lip.append(ul);
    lip.style.listStyle = "none";
    this.before(lip);
    ul.append(this);
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
    } else {
        let ul = li.parentNode;
        p = document.createElement('p');
        while (li.firstChild)
            p.append(li.firstChild);
        li.parentNode.after(p);
        li.remove();
        if (! ul.firstElementChild) ul.remove();
    }
    return true;
}

// TextNode

Text.prototype.oEnter = function(offset) {
    console.log('oBreak Text');
    if (! offset) {
        this.parentElement.oEnter(this);
    } else if (offset >= this.length) {
        let el = this.parentElement.oEnter(this.nextSibling);
        cursorSet(el, 0);
        return true;
    } else {
        let newval = this.nodeValue.substring(0,offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        this.parentElement.oEnter(this)
    }
    cursorSet(this, 0);
}

Text.prototype.oDelete = function(offset) {
    console.log('oDelete Text');
    if (offset === undefined)
        offset = this.nodeValue.length;
    if (offset === 0)
        return (this.previousSibling || this.parentElement).oDelete();
    this.nodeValue = this.nodeValue.substring(0, offset-1) + this.nodeValue.substring(offset);
    cursorSet(this, offset-1);
}

Text.prototype.oTab = function(offset) {
    return this.parentElement.oTab(0);
};

Text.prototype.oShiftTab = function(offset) {
    return this.parentElement.oShiftTab(0);
};

