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
export function mergeNodes(leftNode, rightNode = leftNode.nextSibling) {
    // The given node is not visible. It should not accept new content as the
    // user simply did not know it existed. We simply remove it and return the
    // related merge code.
    if (!isVisible(leftNode)) {
        leftNode.oRemove();
        return MERGE_CODES.REMOVED_INVISIBLE_NODE;
    }

    // The given node is visible but cannot accept contents (like a BR). We
    // remove it and return the related merge code.
    if (isVisibleEmpty(leftNode)) {
        const removedNode = leftNode;

        // Following code handles some specific cases for BR removals.
        // TODO check if this is the right place for it.
        const isBRRemoval = removedNode.nodeName === 'BR';
        if (isBRRemoval) {
            const parentEl = removedNode.parentElement;
            const index = childNodeIndex(removedNode);

            // 1°) Not removing the last BR of a visually empty node
            // TODO review the condition.
            if (!parentEl.textContent && parentEl.children.length === 1) {
                return MERGE_CODES.REMOVED_INVISIBLE_NODE;
            }

            // 2°) Remove leading invisible whitespace in following text content
            // as it would become visible because of BR removal.
            //
            //     <p>ab<br>[] cd</p> + BACKSPACE
            // <=> <p>ab[]cd</p>
            //
            // TODO this may not be specific to BR removal only but to any
            // backspace (to check saveState/restoreState Fabien's idea).
            const spaceNode = findLeadingSpaceNextNode(parentEl, index + 1);
            if (spaceNode) {
                spaceNode.nodeValue = spaceNode.nodeValue.replace(/^[^\S\u00A0]+/, '');
            }

            // 3°) Convert trailing visible whitespace to nbsp in preceding text
            // content as it would become invisible if there is no following
            // text content.
            //
            //     <p>ab <br>[]</p> + BACKSPACE
            // <=> <p>ab&nbsp;</p>
            //
            // TODO this may not be specific to BR removal only but to any
            // backspace (to check saveState/restoreState Fabien's idea).
            const nextContentNode = findVisibleTextNextNode(parentEl, index + 1);
            if (!nextContentNode) {
                const spaceNode = findTrailingSpacePrevNode(parentEl, index);
                if (spaceNode) {
                    spaceNode.nodeValue = spaceNode.nodeValue.replace(/[^\S\u00A0]+$/, '\u00A0');
                }
            }
        }

        removedNode.oRemove();
        return MERGE_CODES.REMOVED_VISIBLE_NODE;
    }

    // The given node can accept content but there is no content to receive,
    // nothing can be merged.
    if (!rightNode) {
        return MERGE_CODES.NOTHING_TO_MERGE;
    }

    // Now actually merge the left and right nodes, depending of if they are
    // blocks or not.
    const leftIsBlock = isBlock(leftNode);
    const rightIsBlock = isBlock(rightNode);

    if (rightIsBlock) {
        // First case, the right side is block content: we have to unwrap that
        // content in the proper location.
        const fragmentEl = document.createDocumentFragment();
        while (rightNode.firstChild) {
            fragmentEl.appendChild(rightNode.firstChild);
        }
        rightNode.oRemove();

        if (leftIsBlock) {
            // If the left side is a block too, find the right position to
            // unwrap the content inside and reposition cursor the right way.
            moveMergedNodes(leftNode, fragmentEl);
        } else {
            // If the left side is inline, simply unwrap at current block
            // location.
            leftNode.after(fragmentEl);
            setCursorEnd(leftNode);
        }
    } else {
        // Second case, the right side is inline content.
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

export const DIRECTIONS = {
    LEFT: 0,
    RIGHT: 1,
};

export const leftDeepFirst = createDOMTraversalGenerator(DIRECTIONS.LEFT, false, false);
export const leftDeepOnly = createDOMTraversalGenerator(DIRECTIONS.LEFT, true, false);
export const leftDeepFirstInline = createDOMTraversalGenerator(DIRECTIONS.LEFT, false, true);
export const leftDeepOnlyInline = createDOMTraversalGenerator(DIRECTIONS.LEFT, true, true);

export const rightDeepFirst = createDOMTraversalGenerator(DIRECTIONS.RIGHT, false, false);
export const rightDeepOnly = createDOMTraversalGenerator(DIRECTIONS.RIGHT, true, false);
export const rightDeepFirstInline = createDOMTraversalGenerator(DIRECTIONS.RIGHT, false, true);
export const rightDeepOnlyInline = createDOMTraversalGenerator(DIRECTIONS.RIGHT, true, true);

/**
 * Any editor command is applied to a selection (collapsed or not). After the
 * command, the content type before that selection and after that selection
 * should be the same (some whitespace should disappear as went from collapsed
 * to non collapsed, or converted to &nbsp; as went from non collapsed to
 * collapsed, there also <br> to remove/duplicate, etc).
 *
 * This function returns a callback which allows to do that after the command
 * has been done. It also prepares the DOM to receive the command in a way
 * the callback will be able to work on.
 *
 * Note: the method has been made generic enough to work with non-collapsed
 * selection but can be used for an unique cursor position.
 *
 * @param {Node} anchorNode
 * @param {number} anchorOffset
 * @param {Node} [focusNode=anchorNode]
 * @param {number} [focusOffset=anchorOffset]
 * @returns {function}
 */
export function prepareUpdate(anchorNode, anchorOffset, focusNode = anchorNode, focusOffset = anchorOffset) {
    // Prepare individual positions.
    [anchorNode, anchorOffset, focusNode, focusOffset]
        = prepareSelection(anchorNode, anchorOffset, focusNode, focusOffset);

    // Check the left state of the selection and the right state of the
    // selection.
    const [leftState, leftNode] = getState(anchorNode, anchorOffset, DIRECTIONS.LEFT);
    const [rightState, rightNode] = getState(focusNode, focusOffset, DIRECTIONS.RIGHT);

    // Create the callback that will be able to restore the state on the left
    // and right nodes after any command processing in-between.
    return {
        restoreStates: function restoreStates() {
            restoreState(leftNode, leftState, DIRECTIONS.LEFT);
            restoreState(rightNode, rightState, DIRECTIONS.RIGHT);
        },
        anchorNode,
        anchorOffset,
        focusNode,
        focusOffset,
    };
}

/**
 * Prepares the individual positions as boundaries for a command. For instance,
 * if the position is inside a text node, we have to split it. This is what most
 * command will need anyway and this will allow to follow the evolution of the
 * individual parts post command (instead of following in-text position as an
 * exception).
 *
 * @param {Node} node1
 * @param {number} offset1
 * @param {Node} [node2]
 * @param {number} [offset2]
 * @return {Array<Node, number>}
 */
export function prepareSelection(node1, offset1, node2, offset2) {
    if (node1.nodeType === Node.TEXT_NODE) {
        if (node2 === node1) {
            offset2 -= offset1;
        }

        offset1 = splitText(node1, offset1);
        node1 = node1.parentNode;
    }
    if (node2) {
        [node2, offset2] = prepareSelection(node2, offset2);
    }
    return [node1, offset1, node2, offset2];
}

const STATES = {
    CONTENT: 0,
    SPACE: 1,
    BLOCK: 2,
};

/**
 * Retrieves the "state" from a given position looking at the given direction.
 * The "state" is the type of content. The functions also returns the first
 * meaninful node looking in the given direction = the first node we trust will
 * not disappear if a command is played in the opposite direction.
 *
 * Note: only work for in-between nodes positions. If the position is inside a
 * text node, first prepare it with @see prepareSelection.
 *
 * @param {HTMLElement} el
 * @param {number} offset
 * @param {number} direction @see DIRECTIONS
 * @returns {Array<number, Node>} @see STATES
 */
export function getState(el, offset, direction) {
    let domTraversal;
    let expr;
    if (direction === DIRECTIONS.LEFT) {
        domTraversal = leftDeepOnlyInline(el, offset);
        expr = /[^\S\u00A0]$/;
    } else {
        domTraversal = rightDeepOnlyInline(el, offset);
        expr = /^[^\S\u00A0]/;
    }

    let lastSpace = null;

    let state = STATES.BLOCK;
    let boundaryNode;

    for (const node of domTraversal) {
        if (!boundaryNode) {
            // TODO I think sometimes, the node we have to consider as the
            // anchor point to restore the state is not the first one of the
            // traversal (like for example, empty text nodes that may disappear
            // after the command so we would not want to get those ones).
            boundaryNode = node;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
            if (isVisibleStr(value)) {
                state = (lastSpace || expr.test(value)) ? STATES.SPACE : STATES.CONTENT;
                break;
            }
            if (value.length) {
                lastSpace = node;
            }
        } else if (node.nodeName === 'BR') {
            state = direction === DIRECTIONS.LEFT ? STATES.BLOCK : STATES.CONTENT;
            break;
        }
    }

    return [state, boundaryNode];
}

/**
 * Restores the given state starting before the given while looking in the given
 * direction.
 *
 * @param {Node} oldNode
 * @param {number} oldState @see STATES
 * @param {number} direction @see DIRECTIONS
 */
export function restoreState(oldNode, oldState, direction) {
    if (!oldNode) {
        return;
    }
    const parentOffset = childNodeIndex(oldNode) + (direction === DIRECTIONS.LEFT ? 1 : 0);
    const [newState, newNode] = getState(oldNode.parentNode, parentOffset, direction); // Note: oldNode = newNode normally
    // TODO
}

/**
 * Returns the deepest child in last position.
 *
 * @param {Node} node
 * @param {boolean} [inline=false]
 * @returns {Node}
 */
export function latestChild(node, inline = false) {
    while (node && node.lastChild && (!inline || !isBlock(node))) {
        node = node.lastChild;
    }
    return node;
}

/**
 * Returns the deepest child in first position.
 *
 * @param {Node} node
 * @param {boolean} [inline=false]
 * @returns {Node}
 */
export function firstChild(node, inline = false) {
    while (node && node.firstChild && (!inline || !isBlock(node))) {
        node = node.firstChild;
    }
    return node;
}

/**
 * Creates a generator function according to the given parameters. Pre-made
 * generators to traverse the DOM are made using this function:
 *
 * @see leftDeepFirst
 * @see leftDeepOnly
 * @see leftDeepFirstInline
 * @see leftDeepOnlyInline
 *
 * @see rightDeepFirst
 * @see rightDeepOnly
 * @see rightDeepFirstInline
 * @see rightDeepOnlyInline
 *
 * @param {number} direction
 * @param {boolean} deepOnly
 * @param {boolean} inline
 */
export function createDOMTraversalGenerator(direction, deepOnly, inline) {
    const nextDeepest = direction === DIRECTIONS.LEFT
        ? node => latestChild(node.previousSibling, inline)
        : node => firstChild(node.nextSibling, inline);

    const firstNode = direction === DIRECTIONS.LEFT
        ? (node, offset) => latestChild(node.childNodes[offset - 1], inline)
        : (node, offset) => firstChild(node.childNodes[offset], inline);

    return function* (node, offset) {
        let movedUp = false;

        let currentNode = node;
        if (offset !== undefined) {
            currentNode = firstNode(node, offset);
            if (!currentNode) {
                movedUp = true;
                currentNode = node;
            }
        }

        while (currentNode) {
            if (inline && isBlock(currentNode)) {
                break;
            }
            if (!deepOnly || !movedUp) {
                yield currentNode;
            }

            movedUp = false;
            currentNode = nextDeepest(currentNode);
            if (!currentNode) {
                movedUp = true;
                currentNode = currentNode.parentNode;
            }
        }
    };
}
