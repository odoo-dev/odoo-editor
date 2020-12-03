"use strict";

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
    return isBlock(node) ? node : closestBlock(node.parentElement);
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
        node => isBlock(node) || node.tagName === 'BR' || stopCallback(node)
    );
}

export function findNextInline(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findNext(
        anchorNode,
        offset,
        findCallback,
        node => isBlock(node) || node.tagName === 'BR' || stopCallback(node)
    );
}

export function findVisibleTextPrevNode(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findPreviousInline(
        anchorNode,
        offset,
        node => isContentTextNode(node) && findCallback(node),
        node => isContentTextNode(node) && stopCallback(node),
    );
}

export function findVisibleTextNextNode(anchorNode, offset, findCallback = node => true, stopCallback = node => false) {
    return findNextInline(
        anchorNode,
        offset,
        node => isContentTextNode(node) && findCallback(node),
        node => isContentTextNode(node) && stopCallback(node),
    );
}

export function findTrailingSpacePrevNode(anchorNode, offset) {
    return findVisibleTextPrevNode(
        anchorNode,
        offset,
        node => /[^\S\u00A0]$/.test(node.nodeValue.replace(INVISIBLE_REGEX, '')),
    );
}

export function findLeadingSpaceNextNode(anchorNode, offset) {
    return findVisibleTextNextNode(
        anchorNode,
        offset,
        node => /^[^\S\u00A0]/.test(node.nodeValue.replace(INVISIBLE_REGEX, '')),
    );
}
/**
 * Adapts left & right nodes to prepare for adding a <block> in anchor/offset
 * position.
 *
 * @param {Node} anchorNode
 * @param {number} offset
 */
export function blockify(anchorNode, offset) {
    const leftTrailingSpaceNode = findTrailingSpacePrevNode(anchorNode, offset);
    if (leftTrailingSpaceNode) {
        if (findVisibleTextNextNode(anchorNode, offset)) {
            leftTrailingSpaceNode.nodeValue = leftTrailingSpaceNode.nodeValue.replace(/[^\S\u00A0]+$/, '\u00A0');
            return;
        }
    }

    const rightLeadingSpaceNode = findLeadingSpaceNextNode(anchorNode, offset);
    if (rightLeadingSpaceNode) {
        if (findVisibleTextPrevNode(anchorNode, offset)) {
            rightLeadingSpaceNode.nodeValue = rightLeadingSpaceNode.nodeValue.replace(/^[^\S\u00A0]+/, '\u00A0');
            return;
        }
    }
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

/**
 * Returns whether or not the given char is a space.
 *
 * @param {string} ch
 * @returns {boolean}
 */
const spaceValues = [' ', '\t', '\n', '\r'];
export function isSpace(ch) {
    return spaceValues.includes(ch);
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

/**
 * Merges the next sibling of the given node into that given node, the way it is
 * done depending of the type of those nodes.
 *
 * @param {Node} leftNode
 * @param {Node} [rightNode=leftNode.nextSibling]
 * @returns {number} Merge type code
 */
export function mergeNodes(leftNode, rightNode = leftNode.nextSibling) {
    if (!isVisible(leftNode)) {
        leftNode.oRemove(); // TODO review the use of 'oRemove' ...
        return MERGE_CODES.REMOVED_INVISIBLE_NODE;
    }

    if (isVisibleEmpty(leftNode)) {
        const removedNode = leftNode;

        const isBRRemoval = removedNode.nodeName === 'BR';
        if (isBRRemoval) {
            const parentEl = removedNode.parentElement;
            const index = childNodeIndex(removedNode);
            // TODO is this the right place for this? Not removing the last br
            // of an empty node.
            if (!parentEl.textContent && parentEl.children.length === 1) {
                return MERGE_CODES.REMOVED_INVISIBLE_NODE;
            }
            // TODO this next rule should probably be handled another way or in a
            // generic way, to see. The idea is "when merging two nodes, first
            // remove leading invisible whitespace in the merge node".
            const spaceNode = findLeadingSpaceNextNode(parentEl, index + 1);
            if (spaceNode) {
                spaceNode.nodeValue = spaceNode.nodeValue.replace(/^[^\S\u00A0]+/, '');
            }
            // TODO review with Fabien's saveState/restoreState idea? Another case
            // of using nbsp instead of whitespace in some case
            const nextContentNode = findVisibleTextNextNode(parentEl, index + 1);
            if (!nextContentNode) {
                const spaceNode = findTrailingSpacePrevNode(parentEl, index);
                if (spaceNode) {
                    spaceNode.nodeValue = spaceNode.nodeValue.replace(/[^\S\u00A0]+$/, '\u00A0');
                }
            }
        }

        removedNode.oRemove(); // TODO review the use of 'oRemove' ...
        return MERGE_CODES.REMOVED_VISIBLE_NODE;
    }

    if (!rightNode) {
        return MERGE_CODES.NOTHING_TO_MERGE;
    }

    const leftIsBlock = isBlock(leftNode);
    const rightIsBlock = isBlock(rightNode);

    if (rightIsBlock) {
        // First case, the right side is block content: we have to unwrap that
        // content in the proper location.
        if (leftIsBlock) {
            // If the left side is a block, find the right position to unwrap
            // right content.
            const fragmentEl = document.createDocumentFragment();
            while (rightNode.firstChild) {
                fragmentEl.appendChild(rightNode.firstChild);
            }
            moveMergedNodes(leftNode, fragmentEl);
        } else {
            // If the left side is inline, simply unwrap at current block location.
            setCursorEnd(leftNode);
            while (rightNode.lastChild) {
                rightNode.after(rightNode.lastChild);
            }
        }
        rightNode.oRemove(); // TODO review the use of 'oRemove' ...
    } else {
        // Second case, the right side is inline content
        if (leftIsBlock) {
            // If the left side is a block, move that inline content and the
            // one which follows in that left side.
            const fragmentEl = document.createDocumentFragment();
            let node = rightNode;
            do {
                let nextNode = node.nextSibling;
                fragmentEl.appendChild(node);
                node = nextNode;
            } while (node && !isBlock(node));
            moveMergedNodes(leftNode, fragmentEl);
        } else {
            // If the left side is also inline, nothing to merge.
            return MERGE_CODES.NOTHING_TO_MERGE;
        }
    }

    return MERGE_CODES.SUCCESS;
}

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
        destinationEl = this.lastElementChild;
    }

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
