"use strict";

const INVISIBLE_REGEX = /\u200c/g;

export const DIRECTIONS = {
    LEFT: false,
    RIGHT: true,
};
export const CTYPES = { // Short for CONTENT_TYPES
    // Inline group
    CONTENT: 1,
    SPACE: 2,

    // Block group
    BLOCK_OUTSIDE: 4,
    BLOCK_INSIDE: 8,

    // Br group
    BR: 16,
};
export const CTGROUPS = { // Short for CONTENT_TYPE_GROUPS
    INLINE: CTYPES.CONTENT | CTYPES.SPACE,
    BLOCK: CTYPES.BLOCK_OUTSIDE | CTYPES.BLOCK_INSIDE,
    BR: CTYPES.BR,
};

//------------------------------------------------------------------------------
// Position and sizes
//------------------------------------------------------------------------------

/**
 * @param {Node} node
 * @returns {Array.<HTMLElement, number>}
 */
export function leftPos(node) {
    return [node.parentNode, childNodeIndex(node)];
}
/**
 * @param {Node} node
 * @returns {Array.<HTMLElement, number>}
 */
export function rightPos(node) {
    return [node.parentNode, childNodeIndex(node) + 1];
}
/**
 * @param {Node} node
 * @returns {Array.<HTMLElement, number, HTMLElement, number>}
 */
export function boundariesOut(node) {
    const index = childNodeIndex(node);
    return [node.parentNode, index, node.parentNode, index + 1];
}
/**
 * @param {Node} node
 * @returns {Array.<Node, number>}
 */
export function startPos(node) {
    return [node, 0];
}
/**
 * @param {Node} node
 * @returns {Array.<Node, number>}
 */
export function endPos(node) {
    return [node, nodeSize(node)];
}
/**
 * @param {Node} node
 * @returns {Array.<node, number, node, number>}
 */
export function boundariesIn(node) {
    return [node, 0, node, nodeSize(node)];
}
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

//------------------------------------------------------------------------------
// DOM Path and node research functions
//------------------------------------------------------------------------------

export const closestPath = function* (node) {
    while (node) {
        yield node;
        node = node.parentNode;
    }
};

export const leftDeepFirstPath = createDOMPathGenerator(DIRECTIONS.LEFT, false, false);
export const leftDeepOnlyPath = createDOMPathGenerator(DIRECTIONS.LEFT, true, false);
export const leftDeepFirstInlinePath = createDOMPathGenerator(DIRECTIONS.LEFT, false, true);
export const leftDeepOnlyInlinePath = createDOMPathGenerator(DIRECTIONS.LEFT, true, true);
export const leftDeepOnlyInlineInScopePath = createDOMPathGenerator(DIRECTIONS.LEFT, true, true, true);

export const rightDeepFirstPath = createDOMPathGenerator(DIRECTIONS.RIGHT, false, false);
export const rightDeepOnlyPath = createDOMPathGenerator(DIRECTIONS.RIGHT, true, false);
export const rightDeepFirstInlinePath = createDOMPathGenerator(DIRECTIONS.RIGHT, false, true);
export const rightDeepOnlyInlinePath = createDOMPathGenerator(DIRECTIONS.RIGHT, true, true);
export const rightDeepOnlyInlineInScopePath = createDOMPathGenerator(DIRECTIONS.RIGHT, true, true, true);

export function findNode(domPath, findCallback = node => true, stopCallback = node => false) {
    for (const node of domPath) {
        if (findCallback(node)) {
            return node;
        }
        if (stopCallback(node)) {
            break;
        }
    }
    return null;
}

export function closestBlock(node) {
    return findNode(closestPath(node), node => isBlock(node));
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
 * Values which can be returned while browsing the DOM which gives information
 * to why the path ended.
 */
const PATH_END_REASONS = {
    NO_NODE: 0,
    BLOCK_OUT: 1,
    BLOCK_HIT: 2,
    OUT_OF_SCOPE: 3,
};
/**
 * Creates a generator function according to the given parameters. Pre-made
 * generators to traverse the DOM are made using this function:
 *
 * @see leftDeepFirstPath
 * @see leftDeepOnlyPath
 * @see leftDeepFirstInlinePath
 * @see leftDeepOnlyInlinePath
 *
 * @see rightDeepFirstPath
 * @see rightDeepOnlyPath
 * @see rightDeepFirstInlinePath
 * @see rightDeepOnlyInlinePath
 *
 * @param {number} direction
 * @param {boolean} deepOnly
 * @param {boolean} inline
 */
export function createDOMPathGenerator(direction, deepOnly, inline, inScope = false) {
    const nextDeepest = direction === DIRECTIONS.LEFT
        ? node => latestChild(node.previousSibling, inline)
        : node => firstChild(node.nextSibling, inline);

    const firstNode = direction === DIRECTIONS.LEFT
        ? (node, offset) => latestChild(node.childNodes[offset - 1], inline)
        : (node, offset) => firstChild(node.childNodes[offset], inline);

    // Note "reasons" is a way for the caller to be able to know why the
    // generator ended yielding values.
    return function* (node, offset, reasons = []) {
        let movedUp = false;

        let currentNode = firstNode(node, offset);
        if (!currentNode) {
            movedUp = true;
            currentNode = node;
        }

        while (currentNode) {
            if (inline && isBlock(currentNode)) {
                reasons.push(movedUp ? PATH_END_REASONS.BLOCK_OUT : PATH_END_REASONS.BLOCK_HIT);
                break;
            }
            if (inScope && currentNode === node) {
                reasons.push(PATH_END_REASONS.OUT_OF_SCOPE);
                break;
            }
            if (!deepOnly || !movedUp) {
                yield currentNode;
            }

            movedUp = false;
            let nextNode = nextDeepest(currentNode);
            if (!nextNode) {
                movedUp = true;
                nextNode = currentNode.parentNode;
            }
            currentNode = nextNode;
        }

        reasons.push(PATH_END_REASONS.NO_NODE);
    };
}

//------------------------------------------------------------------------------
// Cursor management
//------------------------------------------------------------------------------

/**
 * From a given position, returns the normalized version.
 *
 * E.g. <b>abc</b>[]def -> <b>abc[]</b>def
 *
 * @param {Node} node
 * @param {number} offset
 * @param {boolean} [full=true] (if not full, it means we only normalize
 *     positions which are not possible, like the cursor inside an image).
 */
export function getNormalizedCursorPosition(node, offset, full = true) {
    if (isVisibleEmpty(node)) {
        // Cannot put cursor inside those elements, put it after instead.
        [node, offset] = rightPos(node);
    }

    // Be permissive about the received offset.
    offset = Math.min(Math.max(offset, 0), nodeSize(node));

    if (full) {
        // Put the cursor in deepest inline node around the given position if
        // possible.
        let el;
        let elOffset;
        if (node.nodeType === Node.ELEMENT_NODE) {
            el = node;
            elOffset = offset;
        } else if (node.nodeType === Node.TEXT_NODE) {
            if (offset === 0) {
                el = node.parentNode;
                elOffset = childNodeIndex(node);
            } else if (offset === node.length) {
                el = node.parentNode;
                elOffset = childNodeIndex(node) + 1;
            }
        }
        if (el) {
            const leftInlineNode = leftDeepOnlyInlineInScopePath(el, elOffset).next().value;
            let leftVisibleEmpty = false;
            if (leftInlineNode) {
                leftVisibleEmpty = isVisibleEmpty(leftInlineNode);
                [node, offset] = leftVisibleEmpty ? rightPos(leftInlineNode) : endPos(leftInlineNode);
            }
            if (!leftInlineNode || leftVisibleEmpty) {
                const rightInlineNode = rightDeepOnlyInlineInScopePath(el, elOffset).next().value;
                if (rightInlineNode) {
                    const rightVisibleEmpty = isVisibleEmpty(rightInlineNode);
                    if (!(leftVisibleEmpty && rightVisibleEmpty)) {
                        [node, offset] = rightVisibleEmpty ? leftPos(rightInlineNode) : startPos(rightInlineNode);
                    }
                }
            }
        }
    }

    const prevNode = node.nodeType === Node.ELEMENT_NODE && node.childNodes[offset - 1];
    if (prevNode && prevNode.nodeName === 'BR' && isFakeLineBreak(prevNode)) {
        // If trying to put the cursor on the right of a fake line break, put
        // it before instead.
        offset--;
    }

    return [node, offset];
}
/**
 * @param {Node} anchorNode
 * @param {number} anchorOffset
 * @param {Node} focusNode
 * @param {number} focusOffset
 * @param {boolean} [normalize=true]
 * @returns {?Array.<Node, number}
 */
export function setCursor(anchorNode, anchorOffset, focusNode = anchorNode, focusOffset = anchorOffset, normalize = true) {
    if (!anchorNode || !anchorNode.parentNode || !anchorNode.parentNode.closest('body')
            || !focusNode || !focusNode.parentNode || !focusNode.parentNode.closest('body')) {
        return null;
    }

    const seemsCollapsed = (anchorNode === focusNode && anchorOffset === focusOffset);
    [anchorNode, anchorOffset] = getNormalizedCursorPosition(anchorNode, anchorOffset, normalize);
    [focusNode, focusOffset] = seemsCollapsed ? [anchorNode, anchorOffset] : getNormalizedCursorPosition(focusNode, focusOffset, normalize);

    const direction = getCursorDirection(anchorNode, anchorOffset, focusNode, focusOffset);
    const sel = document.defaultView.getSelection();
    const range = new Range();
    if (direction === DIRECTIONS.RIGHT) {
        range.setStart(anchorNode, anchorOffset);
        range.collapse(true);
    } else {
        range.setEnd(anchorNode, anchorOffset);
        range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    sel.extend(focusNode, focusOffset);

    return [anchorNode, anchorOffset, focusNode, focusOffset];
}
/**
 * @param {Node} node
 * @param {boolean} [normalize=true]
 * @returns {?Array.<Node, number}
 */
export function setCursorStart(node, normalize = true) {
    const pos = startPos(node);
    return setCursor(...pos, ...pos, normalize);
}
/**
 * @param {Node} node
 * @param {boolean} [normalize=true]
 * @returns {?Array.<Node, number}
 */
export function setCursorEnd(node, normalize = true) {
    const pos = endPos(node);
    return setCursor(...pos, ...pos, normalize);
}
/**
 * From selection position, checks if it is left-to-right or right-to-left.
 *
 * @param {Node} anchorNode
 * @param {number} anchorOffset
 * @param {Node} focusNode
 * @param {number} focusOffset
 * @returns {(number|false)} the direction of false if the selection is collapsed
 */
export function getCursorDirection(anchorNode, anchorOffset, focusNode, focusOffset) {
    if (anchorNode==focusNode) {
        if (anchorOffset == focusOffset)
            return false;
        return anchorOffset<focusOffset ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
    }
    return (anchorNode.compareDocumentPosition(focusNode) & Node.DOCUMENT_POSITION_FOLLOWING) ? DIRECTIONS.LEFT : DIRECTIONS.RIGHT;
}

export function getCursors() {
    let sel = document.defaultView.getSelection();
    if (getCursorDirection(sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset) == DIRECTIONS.RIGHT)
        return [[sel.focusNode, sel.focusOffset], [sel.anchorNode, sel.anchorOffset]];
    return [[sel.anchorNode, sel.anchorOffset], [sel.focusNode, sel.focusOffset]];
}

export function preserveCursor(sel) {
    sel = sel || document.defaultView.getSelection();
    let cursorPos = [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset];
    return (replace) => {
        replace = replace || new Map();
        cursorPos[0] = replace.get(cursorPos[0]) || cursorPos[0];
        cursorPos[2] = replace.get(cursorPos[2]) || cursorPos[2];
        setCursor(...cursorPos);
    }
}

//------------------------------------------------------------------------------
// DOM Info utils
//------------------------------------------------------------------------------

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

export function isUnbreakable(node) {
    if (!node || node.nodeType === Node.TEXT_NODE) {
        return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return true;
    }
    const isEditableRoot = node.isContentEditable && !node.parentElement.isContentEditable;
    return isEditableRoot || node.hasAttribute('t') || ['TABLE', 'TR', 'TD'].includes(node.tagName) || node.classList.contains('oe_unbreakable');
}

export function containsUnbreakable(node) {
    if (!node) {
        return false;
    }
    return isUnbreakable(node) || containsUnbreakable(node.firstChild);
}

// optimize: use the parent Oid to speed up detection
export function getOuid(node, optimize=false) {
    while (node && !isUnbreakable(node)) {
        if (node.ouid && optimize)
            return node.ouid
        node = node.parentNode;
    }
    return node && node.oid;
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
 * Returns true if the given node is in a PRE context for whitespace handling.
 *
 * @param {Node} node
 * @returns {boolean}
 */
export function isInPre(node) {
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return !!element && (
        !!element.closest('pre') ||
        getComputedStyle(element).getPropertyValue('white-space') === 'pre'
    );
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
    return node.nodeType === Node.TEXT_NODE && (isVisibleStr(node) || isInPre(node));
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
    if (!node) return false;
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

export function getListMode(pnode) {
    if (pnode.tagName == 'OL')
        return 'OL';
    return pnode.classList.contains('checklist') ? 'CL' : 'UL';
}

export function createList(mode) {
    let node = document.createElement(mode=='OL' ? 'OL': 'UL');
    if (mode == 'CL') {
        node.classList.add("checklist");
    }
    return node;
}

export function toggleClass(node, className) {
    node.classList.toggle(className);
    if (!node.className) {
        node.removeAttribute("class");
    }
}

/**
 * Returns whether or not the given node is a BR element which does not really
 * act as a line break, but as a placeholder for the cursor or to make some left
 * element (like a space) visible.
 *
 * @param {HTMLBRElement} brEl
 * @returns {boolean}
 */
export function isFakeLineBreak(brEl) {
    return !(getState(...rightPos(brEl), DIRECTIONS.RIGHT).cType & (CTGROUPS.INLINE | CTGROUPS.BR));
}
/**
 * Checks whether or not the given block has any visible content, except for
 * a placeholder BR.
 *
 * @param {HTMLElement} blockEl
 * @returns {boolean}
 */
export function isEmptyBlock(blockEl) {
    if (isVisibleStr(blockEl.textContent)) {
        return false;
    }
    if (blockEl.querySelectorAll('br').length >= 2) {
        return false;
    }
    const nodes = blockEl.querySelectorAll('*');
    for (const node of nodes) {
        // There is no text and no double BR, the only thing that could make
        // this visible is a "visible empty" node like an image.
        if ((node.nodeName != 'BR') && isVisibleEmpty(node)) {
            return false;
        }
    }
    return true;
}
/**
 * Checks whether or not the given block element has something to make it have
 * a visible height (except for padding / border).
 *
 * @param {HTMLElement} blockEl
 * @returns {boolean}
 */
export function isShrunkBlock(blockEl) {
    return isEmptyBlock(blockEl) && !blockEl.querySelector('br');
}

//------------------------------------------------------------------------------
// DOM Modification
//------------------------------------------------------------------------------

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
export function splitTextNode(textNode, offset) {
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

export function insertText(sel, content) {
    if (sel.anchorNode.nodeType == Node.TEXT_NODE) {
        let pos = [sel.anchorNode.parentElement, splitTextNode(sel.anchorNode, sel.anchorOffset)]
        setCursor(...pos, ...pos, false);
    }
    const txt = document.createTextNode(content || '#')
    const restore = prepareUpdate(sel.anchorNode, sel.anchorOffset);
    sel.getRangeAt(0).insertNode(txt);
    restore();
    setCursor(...boundariesOut(txt), false);
}

/**
 * Add a BR in the given node if its closest ancestor block has nothing to make
 * it visible.
 *
 * @param {HTMLElement} el
 */
export function fillEmpty(el) {
    const blockEl = closestBlock(el);
    if (isShrunkBlock(blockEl)) {
        blockEl.appendChild(document.createElement('br'));
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

export function setTagName(el, newTagName) {
    if (el.tagName == newTagName) {
        return el;
    }
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
/**
 * Moves the given subset of nodes of a source element to the given destination.
 * If the source element is left empty it is removed. This ensures the moved
 * content and its destination surroundings are restored (@see restoreState) to
 * the way there were.
 *
 * It also reposition at the right position on the left of the moved nodes.
 *
 * @param {HTMLElement} destinationEl
 * @param {number} destinationOffset
 * @param {HTMLElement} sourceEl
 * @param {number} [startIndex=0]
 * @param {number} [endIndex=sourceEl.childNodes.length]
 * @returns {Array.<HTMLElement, number} The position at the left of the moved
 *     nodes after the move was done (and where the cursor was returned).
 */
export function moveNodes(destinationEl, destinationOffset, sourceEl, startIndex = 0, endIndex = sourceEl.childNodes.length) {
    // For table elements, there just cannot be a meaningful move, add them
    // after the table.
    if (['TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TH', 'TD'].includes(destinationEl.tagName)) {
        [destinationEl, destinationOffset] = rightPos(destinationEl);
    }

    const nodes = [];
    for (let i = startIndex; i < endIndex; i++) {
        nodes.push(sourceEl.childNodes[i]);
    }

    if (nodes.length) {
        const restoreDestination = prepareUpdate(destinationEl, destinationOffset);
        const restoreMoved = prepareUpdate(...leftPos(sourceEl.childNodes[startIndex]), ...rightPos(sourceEl.childNodes[endIndex - 1]));
        const fragment = document.createDocumentFragment();
        nodes.forEach(node => fragment.appendChild(node));
        const posRightNode = destinationEl.childNodes[destinationOffset];
        if (posRightNode) {
            destinationEl.insertBefore(fragment, posRightNode);
        } else {
            destinationEl.appendChild(fragment);
        }
        restoreDestination();
        restoreMoved();
    }

    if (!nodeSize(sourceEl)) {
        const restoreOrigin = prepareUpdate(...boundariesOut(sourceEl));
        sourceEl.remove();
        restoreOrigin();
    }

    // Return cursor position, but don't change it
    const firstNode = nodes.find(node => !!node.parentNode);
    return firstNode ? leftPos(firstNode) : [destinationEl, destinationOffset];
}

//------------------------------------------------------------------------------
// Prepare / Save / Restore state utilities
//------------------------------------------------------------------------------

/**
 * Any editor command is applied to a selection (collapsed or not). After the
 * command, the content type on the selection boundaries, in both direction,
 * should be preserved (some whitespace should disappear as went from collapsed
 * to non collapsed, or converted to &nbsp; as went from non collapsed to
 * collapsed, there also <br> to remove/duplicate, etc).
 *
 * This function returns a callback which allows to do that after the command
 * has been done.
 *
 * Note: the method has been made generic enough to work with non-collapsed
 * selection but can be used for an unique cursor position.
 *
 * @param {HTMLElement} el
 * @param {number} offset
 * @param {...(HTMLElement|number)} args - argument 1 and 2 can be repeated for
 *     multiple preparations with only one restore callback returned. Note: in
 *     that case, the positions should be given in the document node order.
 * @returns {function}
 */
export function prepareUpdate(el, offset, ...args) {
    const positions = [...arguments];

    // Check the state in each direction starting from each position.
    const restoreData = [];
    while (positions.length) {
        // Note: important to get the positions in reverse order to restore
        // right side before left side.
        offset = positions.pop();
        el = positions.pop();
        const left = getState(el, offset, DIRECTIONS.LEFT);
        restoreData.push(left);
        restoreData.push(getState(el, offset, DIRECTIONS.RIGHT, left.cType));
    }

    // Create the callback that will be able to restore the state in each
    // direction wherever the node in the opposite direction has landed.
    return function restoreStates() {
        for (const data of restoreData) {
            restoreState(data);
        }
    };
}
/**
 * Retrieves the "state" from a given position looking at the given direction.
 * The "state" is the type of content. The functions also returns the first
 * meaninful node looking in the opposite direction = the first node we trust
 * will not disappear if a command is played in the given direction.
 *
 * Note: only work for in-between nodes positions. If the position is inside a
 * text node, first split it @see splitTextNode.
 *
 * @param {HTMLElement} el
 * @param {number} offset
 * @param {number} direction @see DIRECTIONS.LEFT @see DIRECTIONS.RIGHT
 * @returns {Object}
 */
export function getState(el, offset, direction, leftCType) {
    const leftDOMPath = leftDeepOnlyInlinePath;
    const rightDOMPath = rightDeepOnlyInlinePath;

    let domPath;
    let inverseDOMPath;
    let expr;
    const reasons = [];
    if (direction === DIRECTIONS.LEFT) {
        domPath = leftDOMPath(el, offset, reasons);
        inverseDOMPath = rightDOMPath(el, offset);
        expr = /[^\S\u00A0]$/;
    } else {
        domPath = rightDOMPath(el, offset, reasons);
        inverseDOMPath = leftDOMPath(el, offset);
        expr = /^[^\S\u00A0]/;
    }

    // TODO I think sometimes, the node we have to consider as the
    // anchor point to restore the state is not the first one of the inverse
    // path (like for example, empty text nodes that may disappear
    // after the command so we would not want to get those ones).
    const boundaryNode = inverseDOMPath.next().value;

    // We only traverse through deep inline nodes. If we cannot find a
    // meanfingful state between them, that means we hit a block.
    let cType = undefined;

    // Traverse the DOM in the given direction to check what type of content
    // there is.
    let lastSpace = null;
    for (const node of domPath) {
        if (node.nodeType === Node.TEXT_NODE) {
            const value = node.nodeValue.replace(INVISIBLE_REGEX, '');
            // If we hit a text node, the state depends on the path direction:
            // any space encountered backwards is a visible space if we hit
            // visible content afterwards. If going forward, spaces are only
            // visible if we have content backwards.
            if (direction === DIRECTIONS.LEFT) {
                if (isVisibleStr(value)) {
                    cType = (lastSpace || expr.test(value)) ? CTYPES.SPACE : CTYPES.CONTENT;
                    break;
                }
                if (value.length) {
                    lastSpace = node;
                }
            } else {
                leftCType = leftCType || getState(el, offset, DIRECTIONS.LEFT).cType;
                if (expr.test(value)) {
                    const rct = isVisibleStr(value) ? CTYPES.CONTENT : getState(...rightPos(node), DIRECTIONS.RIGHT).cType;
                    cType = ((leftCType & CTYPES.CONTENT) && (rct & (CTYPES.CONTENT | CTYPES.BR))) ? CTYPES.SPACE: rct;
                    break;
                }
                if (isVisibleStr(value)) {
                    cType = CTYPES.CONTENT;
                    break;
                }
            }
        } else if (node.nodeName === 'BR') {
            cType = CTYPES.BR;
            break;
        } else if (isVisible(node)) {
            // E.g. an image
            cType = CTYPES.CONTENT;
            break;
        }
    }

    if (cType === undefined) {
        cType = reasons.includes(PATH_END_REASONS.BLOCK_HIT) ? CTYPES.BLOCK_OUTSIDE : CTYPES.BLOCK_INSIDE;
    }

    return {
        node: boundaryNode,
        direction: direction,
        cType: cType, // Short for contentType
    };
}
const priorityRestoreStateRules = [
    // Each entry is a list of two objects, with each key being optional (the
    // more key-value pairs, the bigger the priority).
    // {direction: ..., cType1: ..., cType2: ...}
    // ->
    // {spaceVisibility: (false|true), brVisibility: (false|true)}
    [
        // Replace a space by &nbsp; when it was not collapsed before and now is
        // collapsed (one-letter word removal for example).
        {cType1: CTYPES.CONTENT, cType2: CTYPES.SPACE | CTGROUPS.BLOCK},
        {spaceVisibility: true},
    ],
    [
        // Replace a space by &nbsp; when it was content before and now it is
        // a BR.
        {direction: DIRECTIONS.LEFT, cType1: CTGROUPS.INLINE, cType2: CTGROUPS.BR},
        {spaceVisibility: true},
    ],
    [
        // Replace a space by &nbsp; when it was visible thanks to a BR which
        // is now gone.
        {direction: DIRECTIONS.RIGHT, cType1: CTGROUPS.BR, cType2: CTYPES.SPACE | CTGROUPS.BLOCK},
        {spaceVisibility: true},
    ],
    [
        // Remove all collapsed spaces when a space is removed.
        {cType1: CTYPES.SPACE},
        {spaceVisibility: false},
    ],
    [
        // Remove spaces once the preceeding BR is removed
        {direction: DIRECTIONS.LEFT, cType1: CTGROUPS.BR},
        {spaceVisibility: false},
    ],
    [
        // Remove space before block once content is put after it (otherwise it
        // would become visible).
        {cType1: CTGROUPS.BLOCK, cType2: CTGROUPS.INLINE | CTGROUPS.BR},
        {spaceVisibility: false},
    ],
    [
        // Duplicate a BR once the content afterwards disappears
        {direction: DIRECTIONS.RIGHT, cType1: CTGROUPS.INLINE, cType2: CTGROUPS.BLOCK},
        {brVisibility: true},
    ],
    [
        // Remove a BR at the end of a block once inline content is put after
        // it (otherwise it would act as a line break).
        {direction: DIRECTIONS.RIGHT, cType1: CTGROUPS.BLOCK, cType2: CTGROUPS.INLINE | CTGROUPS.BR},
        {brVisibility: false},
    ],
    [
        // Remove a BR once the BR that preceeds it is now replaced by
        // content (or if it was a BR at the start of a block which now is
        // a trailing BR).
        {direction: DIRECTIONS.LEFT, cType1: CTGROUPS.BR | CTGROUPS.BLOCK, cType2: CTGROUPS.INLINE},
        {brVisibility: false, extraBRRemovalCondition: brNode => isFakeLineBreak(brNode)},
    ],
];
function restoreStateRuleHashCode(direction, cType1, cType2) {
    return `${direction}-${cType1}-${cType2}`;
}
const allRestoreStateRules = (function () {
    const map = new Map();

    const keys = ['direction', 'cType1', 'cType2'];
    for (const direction of Object.values(DIRECTIONS)) {
        for (const cType1 of Object.values(CTYPES)) {
            for (const cType2 of Object.values(CTYPES)) {
                const rule = {direction: direction, cType1: cType1, cType2: cType2};

                // Search for the rules which match whatever their priority
                const matchedRules = [];
                for (const entry of priorityRestoreStateRules) {
                    let priority = 0;
                    for (const key of keys) {
                        const entryKeyValue = entry[0][key];
                        if (entryKeyValue !== undefined) {
                            if (typeof entryKeyValue === 'boolean' ? (rule[key] === entryKeyValue) : (rule[key] & entryKeyValue)) {
                                priority++;
                            } else {
                                priority = -1;
                                break;
                            }
                        }
                    }
                    if (priority >= 0) {
                        matchedRules.push([priority, entry[1]]);
                    }
                }

                // Create the final rule by merging found rules by order of
                // priority
                const finalRule = {};
                for (let p = 0; p <= keys.length; p++) {
                    for (const entry of matchedRules) {
                        if (entry[0] === p) {
                            Object.assign(finalRule, entry[1]);
                        }
                    }
                }

                // Create an unique identifier for the set of values
                // direction - state 1 - state2 to add the rule in the map
                const hashCode = restoreStateRuleHashCode(direction, cType1, cType2);
                map.set(hashCode, finalRule);
            }
        }
    }

    return map;
})();
/**
 * Restores the given state starting before the given while looking in the given
 * direction.
 *
 * @param {Object} prevStateData @see getState
 */
export function restoreState(prevStateData) {
    const {node, direction, cType: cType1} = prevStateData;
    if (!node || !node.parentNode) {
        // FIXME sometimes we want to restore the state starting from a node
        // which has been removed by another restoreState call... Not sure if
        // it is a problem or not, to investigate.
        return;
    }
    const [el, offset] = direction === DIRECTIONS.LEFT ? leftPos(node) : rightPos(node);
    const {cType: cType2} = getState(el, offset, direction);

    /**
     * Knowing the old state data and the new state data, we know if we have to
     * do something or not, and what to do.
     */
    const ruleHashCode = restoreStateRuleHashCode(direction, cType1, cType2);
    const rule = allRestoreStateRules.get(ruleHashCode);
    if (Object.values(rule).filter(x => x !== undefined).length && !isInPre(el)) {
        const inverseDirection = direction === DIRECTIONS.LEFT ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        enforceWhitespace(el, offset, inverseDirection, rule);
    }
}
/**
 * Enforces the whitespace and BR visibility in the given direction starting
 * from the given position.
 *
 * @param {HTMLElement} el
 * @param {number} offset
 * @param {number} direction @see DIRECTIONS.LEFT @see DIRECTIONS.RIGHT
 * @param {Object} rule
 * @param {boolean} [rule.spaceVisibility]
 * @param {boolean} [rule.brVisibility]
 */
export function enforceWhitespace(el, offset, direction, rule) {
    let domPath;
    let expr;
    if (direction === DIRECTIONS.LEFT) {
        domPath = leftDeepOnlyInlinePath(el, offset);
        expr = /[^\S\u00A0]+$/;
    } else {
        domPath = rightDeepOnlyInlinePath(el, offset);
        expr = /^[^\S\u00A0]+/;
    }

    const invisibleSpaceTextNodes = [];
    let foundVisibleSpaceTextNode = null;
    for (const node of domPath) {
        if (node.nodeName === 'BR') {
            if (rule.brVisibility === undefined) {
                break;
            }
            if (rule.brVisibility) {
                node.before(document.createElement('br'));
            } else {
                if (!rule.extraBRRemovalCondition || rule.extraBRRemovalCondition(node)) {
                    node.remove();
                }
            }
            break;
        } else if (node.nodeType === Node.TEXT_NODE) {
            if (expr.test(node.nodeValue)) {
                // If we hit spaces going in the direction, either they are in a
                // visible text node and we have to change the visibility of
                // those spaces, or it is in an invisible text node. In that
                // last case, we either remove the spaces if there are spaces in
                // a visible text node going further in the direction or we
                // change the visiblity or those spaces.
                if (isVisibleStr(node)) {
                    foundVisibleSpaceTextNode = node;
                    break;
                } else {
                    invisibleSpaceTextNodes.push(node);
                }
            } else if (isVisibleStr(node)) {
                break;
            }
        }
    }

    if (rule.spaceVisibility === undefined) {
        return;
    }
    if (!rule.spaceVisibility) {
        for (const node of invisibleSpaceTextNodes) {
            // Empty and not remove to not mess with offset-based positions in
            // commands implementation, also remove non-block empty parents.
            node.nodeValue = '';
            const ancestorPath = closestPath(node.parentNode);
            let toRemove = null;
            for (const pNode of ancestorPath) {
                if (toRemove) {
                    toRemove.remove();
                }
                if (pNode.childNodes.length === 1 && !isBlock(pNode)) {
                    pNode.after(node);
                    toRemove = pNode;
                } else {
                    break;
                }
            }
        }
    }
    const spaceNode = (foundVisibleSpaceTextNode || invisibleSpaceTextNodes[0]);
    if (spaceNode) {
        let spaceVisibility = rule.spaceVisibility;
        // In case we are asked to replace the space by a &nbsp;, disobey and
        // do the opposite if that space is currently not visible
        // TODO I'd like this to not be needed, it feels wrong...
        if (spaceVisibility && !foundVisibleSpaceTextNode && getState(...rightPos(spaceNode), DIRECTIONS.RIGHT).cType & CTGROUPS.BLOCK) {
            spaceVisibility = false;
        }
        spaceNode.nodeValue = spaceNode.nodeValue.replace(expr, spaceVisibility ? '\u00A0' : '');
    }
}
