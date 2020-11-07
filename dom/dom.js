// backward traversal: latestChild(el.previousSibling) || el.parentNode
function latestChild(el) {
    while (el && el.lastChild) el = el.lastChild;
    return el;
}

function firstChild(el) {
    while (el && el.firstChild) el = el.firstChild;
    return el;
}

function setCursor(node, offset=undefined) {
    let sel = document.defaultView.getSelection();
    let range = new Range();
    if (node.nodeType==Node.TEXT_NODE && !node.parentElement.textContent) {
        node.nodeValue = '\u200c'
        offset=1;
    }
    range.setStart(node, Math.max(offset,0));
    range.setEnd(node, Math.max(offset,0));
    sel.removeAllRanges();
    sel.addRange(range);
}

function setCursorEnd(node) {
    node = latestChild(node);
    setCursor(node, (node.nodeType == Node.TEXT_NODE)?node.length:node.children.length)
}

function fillEmpty(node) {
     if (node && (! node.innerText) && !node.children.length)
         node.append(document.createElement('br'));
}

function isBlock(node) {
    if (!node || (node.nodeType == Node.TEXT_NODE)) return false;
    let style = window.getComputedStyle(node).display;
    return ['block', 'list-item'].includes(style);
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

function setTagName(el, newTagName) {
    var n = document.createElement(newTagName);
    var attr = el.attributes;
    for (var i = 0, len = attr.length; i < len; ++i)
        n.setAttribute(attr[i].name, attr[i].value);
    while (el.firstChild)
        n.append(el.firstChild);
    el.parentNode.replaceChild(n, el);
    return n;
}

function hasBackwardVisibleSpace(node) {
    let last = false;
    do {
        node = latestChild(node.previousSibling) || node.parentElement;
        if (node.nodeType==Node.TEXT_NODE) {
            if (node.nodeValue.search(/[ \t\r\n]/)>-1)
                last = node;
            if (node.nodeValue.replace(/[ \t\r\n]+/, ''))
                return last;
        }
        if (isBlock(node) || (node.tagName=='BR'))
            return last;
    } while (node);
}

function hasForwardVisibleSpace(node) {
    let last = false;
    do {
        node = firstChild(node.nextSibling) || node.parentElement;
        if (node.nodeType==Node.TEXT_NODE) {
            if (node.nodeValue.search(/[ \t\r\n]/)>-1)
                last = node;
            if (node.nodeValue.replace(/[ \t\r\n]+/, ''))
                return last;
        }
        if (isBlock(node) || (node.tagName=='BR'))
            return false;
    } while (node);
}

function hasForwardChar(node) {
    while (node.nextSibling && !isBlock(node.nextSibling)) {
        node = node.nextSibling;
        if (node.nodeType==Node.TEXT_NODE) {
            if (node.nodeValue.replace(/[ \t\r\n]+/, ''))
                return true;
        } else if (node.textContent || (node.tagName=='BR'))
            return true;
    }
    return false;
}

function addBr(node) {
    let br = document.createElement('BR');
    node.after(br);
    if (!hasForwardChar(br))
        node.after(document.createElement('BR'));
    let index = Array.prototype.indexOf.call(br.parentNode.childNodes, br);
    setCursor(br.parentNode, index+1);
    return br;
}

function isInvisible(ch) {
    return ['\u200c'].includes(ch);
}

function isSpace(ch) {
    return [' ', '\t', '\n', '\r'].includes(ch);
}

// Element Keys

// parentElement, but ensure we stay in the scope of an unBreakable
Object.defineProperty(Node.prototype, "oParent", {
    get: function myProperty() {
        if (!isUnbreakable(this.parentElement))
            return this.parentElement;
        let error = new Error('unbreakable');
        throw error;
    }
});

HTMLElement.prototype.oEnter = function(nextSibling) {
    console.log('oEnter Element');
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
    setCursor(new_el, 0);
    return new_el;
}

HTMLElement.prototype.oShiftEnter = function(offset) {
    let br = document.createElement('BR');
    this.before(br);
    return true;
}


// remove PREVIOUS node's trailing character
HTMLElement.prototype.oDeleteBackward = function() {
    console.log('oDeleteBackward Element');
    if (isUnbreakable(this)) return false;
    // merge with preceeding block
    let node = this.previousSibling;
    if (isBlock(this) || isBlock(node)) {
        node = this.previousSibling || this.parentElement;
        node.oMove(this);
        return true;
    }
    let next = latestChild(this.previousSibling) || this.oParent;
    if (! this.textContent)
        this.remove()
    return next.oDeleteBackward();
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
    setCursorEnd(this);
    if (isBlock(src)) {
        let node = latestChild(this);
        // remove invisible stuff until block or text content found
        while (!isBlock(node) && !((node.nodeType==Node.TEXT_NODE) && (node.nodeValue.replace(/[ \n\t\r]/,'')))) {
            let old = node;
            node = latestChild(node.previousSibling) || node.parentNode;
            old.remove();
        }
        while (src.firstChild)
            this.append(src.firstChild);
        src.remove();
     } else {
        let node = src;
        while (node && !isBlock(node)) {
            let next = node.nextSibling;
            this.append(node);
            node = next;
        }
    }
    // setCursorEnd(this);
}

// BR

HTMLBRElement.prototype.oDeleteBackward = function() {
    // propagate delete if we removed an invisible <br/>
    if (!hasForwardChar(this))
        (this.previousSibling || this.oParent).oDeleteBackward();
    this.remove();
}

HTMLBRElement.prototype.oMove = function(src) {
    this.remove();
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
    console.log('oEnter LI');
    if (this.nextElementSibling || this.textContent)
        return HTMLElement.prototype.oEnter.call(this, nextSibling);

    // enter at last li: should remove the <ll> and create an empty paragraph
    let p = document.createElement('p');
    let br = document.createElement('br');
    p.append(br);
    this.closest('ul,ol').after(p);
    this.oRemove();
    setCursor(p, 0);
    return p;
}

HTMLLIElement.prototype.oDeleteBackward = function() {
    console.log('oDeleteBackward LI');
    let target = this.previousElementSibling;
    if (target)
        return HTMLElement.prototype.oDeleteBackward.call(this);

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

    // TODO: improve DOM structure smarter by joining same level sibling (shiftTab already supports it)

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

// Heading

// Cursor end of line: <h1>title[]</h1>  --> <h1>title</h1><p>[]<br/></p>
// Cursor in the line: <h1>tit[]le</h1>  --> <h1>tit</h1><h1>[]le</h1>
HTMLHeadingElement.prototype.oEnter = function(nextSibling) {
    console.log('oEnter Heading');
    let new_el = HTMLElement.prototype.oEnter.call(this, nextSibling);
    if (!new_el.textContent)
        new_el = setTagName(new_el, 'P');
    return new_el;
}

// TextNode

Text.prototype.oShiftEnter = function(offset) {
    if (! offset) {
        let br = document.createElement('BR');
        this.before(br);
    } else if (offset >= this.length) {
        addBr(this);
    } else {
        let newval = this.nodeValue.substring(0,offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        addBr(newText);
        setCursor(this, 0);
    }
    return true;
}

Text.prototype.oEnter = function(offset) {
    console.log('oEnter Text');
    if (! offset) {
        this.oParent.oEnter(this);
    } else if (offset >= this.length) {
        let el = this.oParent.oEnter(this.nextSibling);
        setCursor(el, 0);
        return true;
    } else {
        let parent = this.oParent;                     // check before modification of the DOM
        let newval = this.nodeValue.substring(0,offset).replace(/[ \t]+$/, '\u00A0');
        let newText = document.createTextNode(newval);
        this.before(newText);
        this.nodeValue = this.nodeValue.substring(offset).replace(/^[ \t]+/, '\u00A0');
        parent.oEnter(this);
    }
    setCursor(this, 0);
}

Text.prototype.oDeleteBackward = function(offset=undefined) {
    console.log('oDeleteBackward Text');
    let space = false;
    let value = this.nodeValue;
    if (offset===undefined) offset = offset || value.length;
    let from = offset-1;

    // remove zero-width characters
    while (isInvisible(value.charAt(from))) from--;
    while (isInvisible(value.charAt(offset))) offset++;
    if (from < 0) {
        this.nodeValue = value.substring(offset);
        return HTMLElement.prototype.oDeleteBackward.call(this);
    }

    // if char is space, remove multiple spaces: <p>abc   []</p>
    space = isSpace(value.charAt(from));
    if (space) {
        while (from && (isSpace(value.charAt(from-1)) || isInvisible(value.charAt(from-1))))
            from--;
        // TODO: increae offset for this use case ___[]___
    }
    this.nodeValue = value.substring(0, from) + value.substring(offset);

    // adapt space into &nbsp; and vice-versa, depending on context
    let left =  value.substring(0, from).replace(/[ \t\r\n]+/, '')
    let right = value.substring(offset).replace(/[ \t\r\n]+/, '')
    let leftSpace = hasBackwardVisibleSpace(this);
    let rightSpace = hasForwardVisibleSpace(this);
    if (!from) {
        if (space)                                          // _</b>_[]  or  </p>_[]
            return this.oDeleteBackward(0);
        if (!space && !leftSpace)                            // </p>a[]_
            this.nodeValue = this.nodeValue.replace(/^[ \t\r\n]+/, '\u00A0');
        if (!space && leftSpace)                             // _</b>a[]_
            leftSpace.nodeValue = leftSpace.nodeValue.replace(/[ \t\r\n]+$/, '\u00A0');
    } else if (!right) {
        if (space && rightSpace)                              // _[]</b>_
            return this.oDeleteBackward();
        if (!space && !rightSpace)                            // a_a[]</p>   || <p>___a[]_</p>
            if (left || leftSpace)
                this.nodeValue = this.nodeValue.replace(/[ \t\r\n]+$/, '\u00A0');
    } else {
        if (!right && !space)                               // _a[]_</b>
            this.nodeValue = value.substring(0, from).replace(/[ \t\r\n]+$/, '\u00A0')+value.substring(offset);
        if (!left && !space)                                // </p>_a[]_
            this.nodeValue = value.substring(0, from)+value.substring(offset).replace(/^[ \t\r\n]+/, '\u00A0');
    }

    // // TODO: move this to utils?
    // add a <br> if necessary: double a preceeding one, or inside an empty block
    if (!this.nodeValue.replace(/[ \t\r\n]+/, '') && !hasForwardChar(this)) {
        let node = this;
        do {
            if (node.previousSibling) {
                node = latestChild(node.previousSibling);
                if (node.tagName=="BR") {
                    node.before(document.createElement('BR'));
                    break;
                }
            } else {
                node = node.parentElement;
                if (isBlock(node)) {
                    node.append(document.createElement('BR'));
                    break;
                }
            }
        } while (!isBlock(node) && !((node.nodeType==Node.TEXT_NODE) && node.nodeValue.replace(/[ \t\r\n]+/, '')) )
    }
    setCursor(this, Math.min(from, this.nodeValue.length));
}

Text.prototype.oMove = function(src) {
    this.nodeValue = this.nodeValue.replace(/[ \t\r\n]+$/, '');
    if (! this.nodeValue)
        return (this.previousSibling || this.parentElement).oMove(src)
    setCursorEnd(this);
    if (isBlock(src)) {
        while (src.firstChild)
            this.after(src.firstChild);
        src.remove();
    } else {
        let node = src;
        while (node && !isBlock(node)) {
            this.after(node);
            node = node.nextSibling;
        }
    }
    // setCursorEnd(this);
}


Text.prototype.oTab = function(offset) {
    return this.oParent.oTab(0);
};

Text.prototype.oShiftTab = function(offset) {
    return this.oParent.oShiftTab(0);
};

