
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

function isBlock(node) {
    if (!node || (node.nodeType == Node.TEXT_NODE)) return false;
    let style = window.getComputedStyle(node).display;
    return ['block'].includes(style);
}

function parentBlock(node) {
    return isBlock(node)?node:parentBlock(node.parentElement);
}

function hasPreviousChar(node) {
    if (! node) return False;
    if (hasPreviousChar(node.previousSibling)) return True;
    return (!isBlock(node.parentElement) && hasPreviousChar(node.previousSibling))
}

function isInline(node) {
    if (node.nodeType == Node.TEXT_NODE) return false;
    let style = window.getComputedStyle(node).display;
    return ['inline', 'inline-block'].includes(style);
}

function isUnbreakable(node) {
    return (node.id=="dom");
}

// return the node in which you should add the &nbsp;
function _findTrailingSpace(node) {
    let last = null;
    if (node.nodeType==Node.TEXT_NODE) {
        if (node.nodeValue.match(/[ \n\t]+$/, '')) {
            node.nodeValue = node.nodeValue.replace(/[ \n\t]+$/, '')
            last = node;
        }
        if (node.nodeValue)
            return last;
    }
    if (isBlock(node)) return last;

    while (!isBlock(node) && !node.previousSibling)
        node = node.parentElement;
    if (isBlock(node)) return last;
    node = node.previousSibling;
    if (isBlock(node)) return last;
    while (node.lastChild) node = node.lastChild;
    if (isBlock(node)) return last;

    return _findTrailingSpace(node) || last;
}

function replaceTrailingSpace(node) {
    let lastSpace = _findTrailingSpace(node) || node;
    lastSpace.nodeValue = lastSpace.nodeValue+'\u00A0';
}

// Element Keys

// parentElement, but ensure we stay in the scope of an unBreakable
Object.defineProperty(Node.prototype, "oParent", {
    get: function myProperty() {
        if (!isUnbreakable(this.parentElement))
            return this.parentElement;
        let error = new Error('rollback');
        throw error;
    }
});

HTMLElement.prototype.oEnter = function(nextSibling) {
    console.log('oBreak Element');
    let new_el = document.createElement(this.tagName);

    while (nextSibling) {
        let oldnode = nextSibling;
        nextSibling = nextSibling.nextSibling;
        new_el.append(oldnode);
    }
    fillEmpty(new_el);
    this.after(new_el)

    // escale only if display = inline
    if (isInline(this) && !isUnbreakable(this.parentElement)) {
        this.parentElement.oEnter(new_el);
    } else {
        fillEmpty(this);
    }
    cursorSet(new_el, 0);
    return new_el;
}

// remove PREVIOUS node's trailing character
HTMLElement.prototype.oDeleteBackward = function() {
    console.log('oDeleteBackward Element');
    // merge with preceeding block
    let node = this.previousSibling;
    if (isBlock(this) || isBlock(node)) {
        node = this.previousElementSibling || this.oParent;
        node.oMove(this);
        while (node.lastChild)
            node = node.lastChild;
        cursorSet(node, (node.nodeType == Node.TEXT_NODE)?node.length:node.children.length)
        return true;
    }

    if (! node)
        return this.oParent.oDeleteBackward();

    if (node.nodeType == Node.TEXT_NODE)
        return node.oDeleteBackward();

    if (isInline(node)) {
        while (node.lastChild)
            node = node.lastChild;
        return node.oDeleteBackward();
    }
}

HTMLElement.prototype.oTab = function(offset=undefined) {
    if (isInline(this))
        return this.oParent.oTab(offset);
    return false;
};

HTMLElement.prototype.oShiftTab = function(offset=undefined) {
    if (isInline(this))
        return this.oParent.oShiftTab(offset);
    return false;
};

// Element Utils

HTMLElement.prototype.oRemove = function() {
    console.log('oRemove Element');
    let pe = this.oParent;

    this.remove();
    if (isInline(this))
        pe.oRemove();
}

HTMLElement.prototype.oMove = function(src) {
    if (this.lastElementChild && this.lastElementChild.tagName=='BR')
        this.lastElementChild.remove();
    while (src.textContent)
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
    let ul = this.oParent;
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

HTMLLIElement.prototype.oDeleteBackward = function() {
    console.log('oDeleteBackward LI');
    let target = this.previousElementSibling;
    if (! target) {
        target = document.createElement('p');
        this.oParent.before(target);
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
        this.oParent.oEnter(this);
    } else if (offset >= this.length) {
        let el = this.oParent.oEnter(this.nextSibling);
        cursorSet(el, 0);
        return true;
    } else {
        let newval = this.nodeValue.substring(0,offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        this.oParent.oEnter(this)
    }
    cursorSet(this, 0);
}

Text.prototype.oDeleteBackward = function(offset=undefined) {
    console.log('oDeleteBackward Text');
    let node = this;
    if (!this.nodeValue) {
        while (isInline(node.oParent) && !node.oParent.innerText) {
            let oldnode = node;
            node = node.oParent;
            oldnode.remove();
        }
        return HTMLElement.prototype.oDeleteBackward.call(node);
    }

    if (offset === 0) {
        return HTMLElement.prototype.oDeleteBackward.call(this);
    }
    let value = this.nodeValue;
    offset = offset || value.length;
    let from = offset - 1;

    // if char is space, remove multiple spaces: <p>abc   []</p>
    if ([' ', '\t', '\n'].includes(value.charAt(from)))
        while (from && [' ', '\t', '\n'].includes(value.charAt(from-1)))
            from--;

    let pnode = parentBlock(this);
    let oldsize = pnode.innerText.length;
    this.nodeValue = value.substring(0, from) + value.substring(offset);
    let removed = oldsize - pnode.innerText.length;

    // we just removed empty spaces at beginning (!from) or end; propagate
    if (!removed) {
        let prec = from?this:this.previousSibling || this.oParent;
        if (!this.nodeValue.length) this.remove();
        return prec.oDeleteBackward();
    }

    // trailing space to add, if there is a non space character before <p>abc b[]</p>
    if ((removed == 2) && value.substring(0, from).replace(/[ \t\n]+/, ''))
        this.nodeValue = this.nodeValue.replace(/[ \t]+$/, '\u00A0');

    // restore trailing space in other blocks <p><u>abc </u><b> b[]</bold></p>
    removed = oldsize - pnode.innerText.length;
    if (removed == 2)
        replaceTrailingSpace(this);

    // if last visible character deleted from a block, add a <br> to keep block visible
    cursorSet(this, Math.min(from, this.nodeValue.length));

    // remove empty inline blocks cascading. What about o.remove?
    if (!pnode.innerText) {
        while (pnode.firstChild) pnode.firstChild.remove();
        pnode.append(document.createElement('br'));
        cursorSet(pnode, 0);
    }
}

Text.prototype.oTab = function(offset) {
    return this.oParent.oTab(0);
};

Text.prototype.oShiftTab = function(offset) {
    return this.oParent.oShiftTab(0);
};

