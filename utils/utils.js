"use strict";

import {
    UNBREAKABLE_ROLLBACK_CODE,
} from "../editor.js";

const INVISIBLE_REGEX = /\u200c/g;

export const MERGE_CODES = {
    SUCCESS: 100,
    NOTHING_TO_MERGE: 101,
    REMOVED_INVISIBLE_NODE: 102,
    REMOVED_VISIBLE_NODE: 103,
};

/**
 * Returns the given node's position relative to its parent (= its index in the
 * child nodes of its parent).
 *
 * @param {Node} node
 * @returns {number}
 */
export function childNodeIndex(node) {
    let i = 0;
    while (node.previousSibling) {
        i++;
        node = node.previousSibling;
    }
    return i;
}

/**
 * Returns the size of the node = the number of characters for text nodes and
 * the number of child nodes for element nodes.
 *
 * @param {Node} node
 * @returns {number}
 */
export function nodeSize(node) {
    const isTextNode = node.nodeType === Node.TEXT_NODE;
    return isTextNode ? node.length : node.childNodes.length;
}

/**
 * Splits a text node in two parts.
 * If the split occurs at the beginning or the end, the text node stays
 * untouched and unsplit. If a split actually occurs, the original text node
 * still exists and become the right part of the split.
 *
 * Note: if split after or before whitespace, that whitespace may become
 * invisible, it is up to the caller to replace it by nbsp if needed.
 *
 * @param {Text} textNode
 * @param {number} offset
 * @returns {number} The parentOffset if the cursor was between the two text
 *          node parts after the split.
 */
export function splitText(textNode, offset) {
    let parentOffset = childNodeIndex(textNode);

    if (offset > 0) {
        parentOffset++;

        if (offset < textNode.length) {
            const newval = textNode.nodeValue.substring(0, offset);
            const nextTextNode = document.createTextNode(newval);
            textNode.before(nextTextNode);
            textNode.nodeValue = textNode.nodeValue.substring(offset);
        }
    }
    return parentOffset;
}

export function splitTextNode(textNode, offset) {
    const newval = textNode.nodeValue.substring(0, offset);
    const nextTextNode = document.createTextNode(newval);
    textNode.before(nextTextNode);
    textNode.nodeValue = textNode.nodeValue.substring(offset);
    return nextTextNode;
}

// backward traversal: latestChild(el.previousSibling) || el.parentNode
export function latestChild(el) {
    while (el && el.lastChild  && !isBlock(el)) {
        el = el.lastChild;
    }
    return el;
}

export function firstChild(el) {
    while (el && (!isBlock(el)) && el.firstChild) {
        el = el.firstChild;
    }
    return el;
}

export function nextNode(el) {
    if (el.firstChild)
        return firstChild(el);
    while (!el.nextSibling) {
        el = el.parentElement;
        if (isBlock(el)) return el;
    }
    return firstChild(el.nextSibling)
}

export function previousNode(el, blocks=false) {
    return latestChild(el.previousSibling) || el.parentNode;
}

export function setCursor(node, offset = undefined) {
    let sel = document.defaultView.getSelection();
    let range = new Range();
    if (node.childNodes.length === offset && node.lastChild instanceof HTMLBRElement) {
        offset--;
    }
    range.setStart(node, Math.max(offset, 0));
    range.setEnd(node, Math.max(offset, 0));
    sel.removeAllRanges();
    sel.addRange(range);
}

export function setCursorStart(node) {
    node = firstChild(node);
    if (node.nodeName === 'BR') { // TODO improve / unify setCursorEnd
        setCursor(node.parentElement, childNodeIndex(node));
        return;
    }
    setCursor(node, 0);
}

export function setCursorEnd(node) {
    node = latestChild(node);
    if (node.nodeName === 'BR') { // TODO improve / unify setCursorEnd
        setCursor(node.parentElement, childNodeIndex(node) + (isFakeLineBreak(node) ? 0 : 1));
        return;
    }
    setCursor(node, nodeSize(node));
}

/**
 * Add a BR in the given node if its closest ancestor block has none to make
 * it visible.
 *
 * @param {HTMLElement} el
 */
export function fillEmpty(el) {
    const blockEl = closestBlock(el);
    if (!isVisibleStr(blockEl.textContent) && !blockEl.querySelector('br')) {
        el.appendChild(document.createElement('br'));
    }
}

/**
 * Removes the given node if invisible and all its invisible ancestors.
 *
 * @param {Node} node
 * @returns {Node} the first visible ancestor of node (or itself)
 */
export function clearEmpty(node) {
    while (!isVisible(node)) {
        const toRemove = node;
        node = node.parentNode;
        toRemove.remove();
    }
    return node;
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

export function closestBlock(node) {
    return findNode(node, node => node.parentNode, node => isBlock(node));
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

export function findNode(node, iterationCallback = node => node.parentNode, findCallback = node => true, stopCallback = node => false) {
    while (node) {
        if (findCallback(node)) {
            return node;
        }
        if (stopCallback(node)) {
            break;
        }
        node = iterationCallback(node);
    }
    return null;
}

export function findPrevious(anchorNode, offset, ...args) {
    const node = latestChild(anchorNode.childNodes[offset - 1]) || anchorNode;
    return findNode(node, node => latestChild(node.previousSibling) || node.parentElement, ...args);
}

export function findNext(anchorNode, offset, ...args) {
    const node = firstChild(anchorNode.childNodes[offset]) || anchorNode;
    return findNode(node, node => firstChild(node.nextSibling) || node.parentElement, ...args);
}

export function findPreviousInline(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findPrevious(
        anchorNode,
        offset,
        findCallback,
        node => isBlock(node) || isVisibleEmpty(node) || stopCallback(node)
    );
}

export function findNextInline(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findNext(
        anchorNode,
        offset,
        findCallback,
        node => isBlock(node) || isVisibleEmpty(node) || stopCallback(node)
    );
}

export function findVisibleTextPrevNode(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findPreviousInline(
        anchorNode,
        offset,
        node => isContentTextNode(node) && findCallback(node),
        node => isContentTextNode(node) || stopCallback(node),
    );
}

export function findVisibleTextNextNode(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findNextInline(
        anchorNode,
        offset,
        node => isContentTextNode(node) && findCallback(node),
        node => isContentTextNode(node) || stopCallback(node),
    );
}


// @returns what's visible on the left of node: space | content | block
export function getLeftState(node, lastSpace=null, direction=previousNode, expr=/[^\S\u00A0]$/) {
    if (node.nodeType === Node.TEXT_NODE) {
        let value = node.nodeValue.replace(INVISIBLE_REGEX, '');
        if (isVisibleStr(node)) {
            return (lastSpace || expr.test(value)) ? 'space' : 'content';
        }
        lastSpace = value.length ? node : lastSpace;
    } else if (isBlock(node)) {
        return 'block';
    } else if (node.nodeName=='BR') {
        return (direction==previousNode) ? 'block' : 'content';
    }
    return getLeftState(direction(node), lastSpace, direction, expr);
}

export function getRightState(node) {return getLeftState(node, null, nextNode, /^[^\S\u00A0]/)};

export function replacePreviousSpace(node, replace='') {
    const expr=/[^\S\u00A0]+$/;
    let last = false;
    if (isBlock(node)) {
        return false;
    } else if (node.nodeName=='BR') {
        if (replace)
            node.before(document.createElement('BR'));
        if (!replace)
            node.remove();
        return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
        last = expr.test(value) ? node : last;
    }

    if ((node.nodeType != Node.TEXT_NODE) || ! isVisibleStr(node))
        last = replacePreviousSpace(previousNode(node), replace) || last;

    if (node.nodeType == Node.TEXT_NODE) {
        const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
        node.nodeValue = value.replace(expr, (last==node) ? replace : '');
        last = false;
    }
    return last;
}

export function replaceNextSpace(node, replace='', first=true) {
    const expr = /^[^\S\u00A0]+/;
    let tochange = false;
    if (isBlock(node)) {
        return false;
    } else if (node.nodeName=='BR') {
        if (replace && (getRightState(node) != 'block'))
            node.before(document.createElement('BR'));
        if (!replace)
            node.remove();
        return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
        tochange = first && expr.test(value);
        first = false;
    }
    let visible = isVisibleStr(node) || replaceNextSpace(nextNode(node), replace, first);
    if (visible && (node.nodeType === Node.TEXT_NODE)) {
        const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
        node.nodeValue = value.replace(expr, tochange ? replace : '');
    }
    return visible;
}


// Preserve the visibility of 'br' & 'space' on the right of the node, if we update it's left elements
// @returns callback to call once left changes have been done, it will update the node & it's right
//
// Example: <p><b>test</b><i> my</i></p>
//
//   cb = updateNodeLeft(i);
//   b.remove();
//   cb();
//   // " my" -> transformed to "&nbsp;my"
//
// Example2: <p>This<br>  <i> my</i></p>
//
//   cb = updateNodeLeft(i);
//   br.remove();
//   cb();
//   // " my" -> transformed to "my", and "  " -> ""
//
// Example3: <p>This<br>  <i> my</i></p>
//
//   cb = updateNodeLeft(i);
//   br.remove();
//   This.remove();
//   cb();
//   // nothing change on right: <p>  <i> my</i></p>
//
export function updateNodeLeft(node) {
    if (!node) return () => {};
    const init = getLeftState(previousNode(node));
    return () => {
        const end = getLeftState(previousNode(node));
        let replace = '';
        switch (init+end) {
            case 'contentspace':
            case 'contentblock':
                replace = '\u00A0';
            case 'blockcontent':
            case 'spacecontent':
                replaceNextSpace(node, replace);
        }
        return node;
    }
}

export function updateNodeRight(node) {
    if (!node) return () => {};
    const init = getRightState(nextNode(node));
    return () => {
        const end = getRightState(nextNode(node));
        let replace = '';
        switch (init+end) {
            case 'contentblock':
                replace = '\u00A0';
            case 'blockcontent':
                replacePreviousSpace(node, replace);
        }
        return node;
    }
}


/**
 * Adapts left & right nodes to prepare for adding a <block> in anchor/offset
 * position.
 *
 * @param {Node} anchorNode
 * @param {number} offset
 */
export function changeNode(anchorNode, offset) {
    let left = findPrevious(anchorNode, offset);
    let right = nextNode(left);
    return [updateNodeRight(left), updateNodeLeft(right)];
}

/**
 * Returns whether the given node is a element that could be considered to be
 * removed by itself = self closing tags.
 *
 * @param {Node} node
 * @returns {boolean}
 */
const selfClosingElementTags = ['BR', 'IMG', 'INPUT'];
export function isVisibleEmpty(node) {
    return selfClosingElementTags.includes(node.nodeName);
}

/**
 * Returns whether the given string (or given text node value) has
 * non-whitespace characters in it.
 */
const nonWhitespacesRegex = /[\S\u00A0]/;
export function isVisibleStr(value) {
    const str = typeof value === 'string' ? value : value.nodeValue;
    return nonWhitespacesRegex.test(str);
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
export function isContentTextNode(node) {
    return node.nodeType === Node.TEXT_NODE && isVisibleStr(node);
}

/**
 * Returns whether removing the given node from the DOM will have a visible
 * effect or not.
 *
 * Note: TODO this is not handling all cases right now, just the ones the
 * caller needs at the moment. For example a space text node between two inlines
 * will always return 'true' while it is sometimes invisible.
 *
 * @param {Node} node
 * @returns {boolean}
 */
export function isVisible(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (!node.length) {
            return false;
        }
        // If contains non-whitespaces: visible
        if (isVisibleStr(node)) {
            return true;
        }
        // If only whitespaces, visible only if has inline content before and
        // after the text node, so '___' is not visible in those cases:
        // - <p>a</p>___<p>b</p>
        // - <p>a</p>___b
        // - a___<p>b</p>
        // TODO see documentation comment
        return (node.previousSibling && !isBlock(node.previousSibling) && node.nextSibling && !isBlock(node.nextSibling));
    }
    if (isBlock(node) || isVisibleEmpty(node)) {
        return true;
    }
    return [...node.childNodes].some(n => isVisible(n));
}

/**
 * Returns whether or not the given char is invisible = a character that the
 * user should never have to remove himself.
 *
 * @param {string} ch
 * @returns {boolean}
 */
const invisibleCharValues = ['\u200c'];
export function isInvisibleChar(ch) {
    return invisibleCharValues.includes(ch);
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

export function areSimilarElements(node, node2) {
    if (!node || !node2 || node.nodeType !== Node.ELEMENT_NODE || node2.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }
    if (node.tagName !== node2.tagName) {
        return false;
    }
    for (const att of node.attributes) {
        const att2 = node2.attributes[att.name];
        if ((att2 && att2.value) !== att.value) {
            return false;
        }
    }
    for (const att of node2.attributes) {
        const att2 = node.attributes[att.name];
        if ((att2 && att2.value) !== att.value) {
            return false;
        }
    }
    if (getComputedStyle(node, ':before').getPropertyValue('content') !== 'none'
            || getComputedStyle(node, ':after').getPropertyValue('content') !== 'none'
            || getComputedStyle(node2, ':before').getPropertyValue('content') !== 'none'
            || getComputedStyle(node2, ':after').getPropertyValue('content') !== 'none') {
        return false;
    }
    return !isBlock(node) && !isBlock(node2) && !isVisibleEmpty(node) && !isVisibleEmpty(node2);
}

/**
 * Merges the second given node or following sibling of the first given node
 * into that first given node, the way it i done depending of the type of those
 * nodes and their context.
 *
 * @param {Node} leftNode
 * @param {Node} [rightNode=leftNode.nextSibling]
 * @returns {number} Merge type code @see MERGE_CODES
 */
/**
 * Moves the given nodes in the given fragment to the given destination element.
 * That destination element is prepared first and adapted if necessary. The
 * cursor is then placed inside, before the moved elements.
 *
 * @param {Element} destinationEl
 * @param {DocumentFragment} sourceFragment
 * @returns {Element} The element where the elements where actually moved.
 */
export function moveMergedNodes(destinationEl, sourceFragment) {
    // For list elements, the proper location is that last list item
    if (destinationEl.tagName === 'UL' || destinationEl.tagName === 'OL') {
        destinationEl = destinationEl.lastElementChild;
    }
    // For table elements, there just cannot be a meaningful move, add them
    // after the table.
    if (['TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TH', 'TD'].includes(destinationEl.tagName)) {
        throw UNBREAKABLE_ROLLBACK_CODE;
    }

    // Merge into deepest ending block
    destinationEl = findNode(
        latestChild(destinationEl),
        node => node.parentNode,
        node => node === destinationEl || isBlock(node)
    );

    // Remove trailing BR at destination if its purpose changes after receiving
    // the merged nodes.
    const originalLastEl = destinationEl.lastElementChild;
    const isOriginalLastElAFakeLineBreak = isFakeLineBreak(originalLastEl);

    const latestChildEl = latestChild(destinationEl);
    destinationEl.appendChild(sourceFragment);
    if (latestChildEl !== destinationEl) {
        setCursorEnd(latestChildEl);
    } else {
        setCursorStart(destinationEl);
    }

    if (isOriginalLastElAFakeLineBreak !== isFakeLineBreak(originalLastEl)) {
        originalLastEl.remove();
    }

    return destinationEl;
}

/**
 * Returns whether or not the given node is a BR element which really acts as a
 * line break, not as a placeholder for the cursor.
 */
export function isRealLineBreak(node) {
    return (node instanceof HTMLBRElement
        && (findVisibleTextNextNode(node.parentNode, childNodeIndex(node) + 1)
            || findNextInline(node.parentNode, childNodeIndex(node) + 1, node => node instanceof HTMLBRElement)));
}

/**
 * Inverse as @see isRealLineBreak but also returns false if not a BR.
 *
 * (e.g. should be removed if content added after it:
 * <p><br><br>[]</p> + TYPE 'a' -> <p><br>a</p> OR <p><br>a<br></p> but not
 * <p><br><br>a</p>).
 */
export function isFakeLineBreak(node) {
    return (node instanceof HTMLBRElement && !isRealLineBreak(node));
}
