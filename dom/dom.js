// Element Keys

HTMLElement.prototype.oEnter = function(node) {
    console.log('oBreak Element');
    let style = window.getComputedStyle(this).display;
    let new_el = document.createElement(this.tagName);
    while (node) {
        let oldnode = node;
        node = node.nextSibling;
        new_el.append(oldnode);
    }
    this.after(new_el)

    // escale only if display = inline
    if (['inline', 'inline-block'].includes(style))
        this.parentElement.oEnter(new_el);
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

HTMLLIElement.prototype.oEnter = function(node) {
    console.log('oBreak LI');
    if (! this.nextElementSibling && ! this.textContent)
        return this.oRemove();
    return HTMLElement.prototype.oEnter.call(this, node);
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
    if (! offset)
        return this.parentElement.oEnter(this);
    if (offset >= this.length)
        return this.parentElement.oEnter(null);

    let newText = document.createTextNode(this.nodeValue.substring(offset));
    this.after(newText);
    this.nodeValue = this.nodeValue.substring(0, offset);
    return this.parentElement.oEnter(newText)
}

Text.prototype.oDelete = function(offset) {
    console.log('oDelete Text');
    if (offset === undefined)
        offset = this.nodeValue.length;
    if (offset === 0)
        return (this.previousSibling || this.parentElement).oDelete();
    this.nodeValue = this.nodeValue.substring(0, offset-1) + this.nodeValue.substring(offset);
    return true;
}

Text.prototype.oTab = function(offset) {
    return this.parentElement.oTab(0);
};

Text.prototype.oShiftTab = function(offset) {
    return this.parentElement.oShiftTab(0);
};

