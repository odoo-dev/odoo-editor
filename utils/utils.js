"use strict";

// backward traversal: latestChild(el.previousSibling) || el.parentNode
export function latestChild(el) {
    while (el && el.lastChild) {
        el = el.lastChild;
    }
    return el;
}

export function firstChild(el) {
    while (el && el.firstChild) {
        el = el.firstChild;
    }
    return el;
}

export function setCursor(node, offset = undefined) {
    let sel = document.defaultView.getSelection();
    let range = new Range();
    if (node.nodeType === Node.TEXT_NODE && !node.parentElement.textContent) {
        node.nodeValue = '\u200c';
        offset = 1;
    }
    range.setStart(node, Math.max(offset, 0));
    range.setEnd(node, Math.max(offset, 0));
    sel.removeAllRanges();
    sel.addRange(range);
}

export function setCursorEnd(node) {
    node = latestChild(node);
    setCursor(node, node.nodeType === Node.TEXT_NODE ? node.length : node.children.length);
}

export function fillEmpty(node) {
    if (node && !node.innerText.replace(/[ \r\n\t]+/, '') && !node.querySelector('br')) { // to improve
        node.append(document.createElement('br'));
    }
}

/**
 * The following is a complete list of all HTML "block-level" elements.
 *
 * Source:
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
 *
 * */
const blockTagNames = [
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DETAILS',
    'DIALOG',
    'DD',
    'DIV',
    'DL',
    'DT',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HGROUP',
    'HR',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'UL',
    // The following elements are not in the W3C list, for some reason.
    'SELECT',
    'TR',
    'TD',
    'TBODY',
    'THEAD',
    'TH',
];
const computedStyles = new WeakMap();
/**
 * Return true if the given node is a block-level element, false otherwise.
 *
 * @param node
 */
export function isBlock(node) {
    if (!(node instanceof Element)) {
        return false;
    }
    const tagName = node.nodeName.toUpperCase();
    // Every custom jw-* node will be considered as blocks.
    if (tagName.startsWith('JW-') || tagName === 'T') {
        return true;
    }
    // The node might not be in the DOM, in which case it has no CSS values.
    if (window.document !== node.ownerDocument) {
        return blockTagNames.includes(tagName);
    }
    // We won't call `getComputedStyle` more than once per node.
    let style = computedStyles.get(node);
    if (!style) {
        style = window.getComputedStyle(node);
        computedStyles.set(node, style);
    }
    if (style.display) {
        return !style.display.includes('inline') && style.display !== 'contents';
    }
    return blockTagNames.includes(tagName);
}

export function parentBlock(node) {
    return isBlock(node) ? node : parentBlock(node.parentElement);
}

export function hasPreviousChar(node) {
    if (!node) {
        return false;
    }
    if (hasPreviousChar(node.previousSibling)) {
        return true;
    }
    return (!isBlock(node.parentElement) && hasPreviousChar(node.previousSibling));
}

export function isUnbreakable(node) {
    if (!node || node.nodeType === Node.TEXT_NODE) {
        return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return true;
    }
    const isEditableRoot = node.isContentEditable && !node.parentElement.isContentEditable;
    return isEditableRoot || node.hasAttribute('t') || ['TABLE', 'TR', 'TD'].includes(node.tagName);
}

export function containsUnbreakable(node) {
    if (!node) {
        return false;
    }
    return isUnbreakable(node) || containsUnbreakable(node.firstChild);
}

export function inUnbreakable(node) {
    while (node && !isUnbreakable(node)) {
        node = node.parentNode;
    }
    return node || null;
}

export function setTagName(el, newTagName) {
    var n = document.createElement(newTagName);
    var attr = el.attributes;
    for (var i = 0, len = attr.length; i < len; ++i) {
        n.setAttribute(attr[i].name, attr[i].value);
    }
    while (el.firstChild) {
        n.append(el.firstChild);
    }
    if (el.tagName === 'LI') {
        el.append(n);
    } else {
        el.parentNode.replaceChild(n, el);
    }
    return n;
}

export function hasBackwardVisibleSpace(node) {
    let last = false;
    do {
        node = latestChild(node.previousSibling) || node.parentElement;
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue.search(/\s/) > -1) {
                last = node;
            }
            if (node.nodeValue.replace(/\s+/, '')) {
                return last;
            }
        }
        if (isBlock(node) || node.tagName === 'BR') {
            return last;
        }
    } while (node);
}

export function hasForwardVisibleSpace(node) {
    let last = false;
    do {
        node = firstChild(node.nextSibling) || node.parentElement;
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue.search(/\s/) > -1) {
                last = node;
            }
            if (node.nodeValue.replace(/\s+/, '')) {
                return last;
            }
        }
        if (isBlock(node) || node.tagName === 'BR') {
            return false;
        }
    } while (node);
}

export function hasForwardChar(node) {
    while (node.nextSibling && !isBlock(node.nextSibling)) {
        node = node.nextSibling;
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.replace(/\s+/, '')
                || node.textContent
                || node.tagName === 'BR') {
            return true;
        }
    }
    return false;
}

export function addBr(node) {
    let br = document.createElement('BR');
    node.after(br);
    if (!hasForwardChar(br)) {
        node.after(document.createElement('BR'));
    }
    let index = Array.prototype.indexOf.call(br.parentNode.childNodes, br);
    setCursor(br.parentNode, index + 1);
    return br;
}

export function isInvisible(ch) {
    return ['\u200c'].includes(ch);
}

export function isSpace(ch) {
    return [' ', '\t', '\n', '\r'].includes(ch);
}

export function parentsGet(node, root = undefined) {
    let parents = [];
    while (node) {
        parents.unshift(node);
        if (node === root) {
            break;
        }
        node = node.parentNode;
    }
    return parents;
}

export function commonParentGet(node1, node2, root = undefined) {
    if (!node1 || !node2) {
        return null;
    }
    let n1p = parentsGet(node1, root);
    let n2p = parentsGet(node2, root);
    while (n1p.length > 1 && n1p[1] === n2p[1]) {
        n1p.shift();
        n2p.shift();
    }
    return n1p[0];
}

export function isSimilarNode(node, node2) {
    if (!node2 || node.nodeType !== node2.nodeType) {
        return false;
    }
    if (node.nodeType === node.ELEMENT_NODE) {
        if (node.tagName !== node2.tagName) {
            return false;
        }
        for (let att in node.attributes) {
            if (node[att] !== node2[att]) {
                return false;
            }
        }
        for (let att in node2.attributes) {
            if (node[att] !== node2[att]) {
                return false;
            }
        }
    }
    return ['b', 'u', 'i', 'strong', 'strong', 'em', 'strike'].includes(node.tagName);
}
