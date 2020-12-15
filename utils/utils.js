"use strict";

const INVISIBLE_REGEX = /\u200c/g;

//------------------------------------------------------------------------------
// Position and sizes
//------------------------------------------------------------------------------

export const DIRECTIONS = {
    LEFT: false,
    RIGHT: true,
};

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
 * @param {HTMLElement} el
 * @returns {Array.<HTMLElement, number>}
 */
export function startPos(el) {
    return [el, 0];
}
/**
 * @param {HTMLElement} el
 * @returns {Array.<HTMLElement, number>}
 */
export function endPos(el) {
    return [el, el.childNodes.length];
}
/**
 * @param {HTMLElement} el
 * @returns {Array.<HTMLElement, number, HTMLElement, number>}
 */
export function boundariesIn(el) {
    return [el, 0, el, el.childNodes.length];
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

export const rightDeepFirstPath = createDOMPathGenerator(DIRECTIONS.RIGHT, false, false);
export const rightDeepOnlyPath = createDOMPathGenerator(DIRECTIONS.RIGHT, true, false);
export const rightDeepFirstInlinePath = createDOMPathGenerator(DIRECTIONS.RIGHT, false, true);
export const rightDeepOnlyInlinePath = createDOMPathGenerator(DIRECTIONS.RIGHT, true, true);

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

export function findVisibleTextNode(domPath, findCallback = node => true, stopCallback = node => false) {
    return findNode(
        domPath,
        node => isContentTextNode(node) && findCallback(node),
        node => isContentTextNode(node) || stopCallback(node),
    );
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
export function createDOMPathGenerator(direction, deepOnly, inline) {
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
                reasons.push(movedUp ? PATH_END_REASONS.BLOCK_OUT : PATH_END_REASONS.BLOCK_HIT);
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

export function setCursor(node, offset = undefined) {
    if (!node || !node.parentElement || !node.parentElement.closest('body')) {
        return;
    }

    let sel = document.defaultView.getSelection();
    let range = new Range();
    if (node.childNodes.length === offset && node.lastChild instanceof HTMLBRElement) {
        offset--;
    }
    offset = Math.min(Math.max(offset, 0), nodeSize(node));
    range.setStart(node, offset);
    range.setEnd(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);
    return [node, offset];
}

export function setCursorStart(node) {
    node = firstChild(node);
    if (isVisibleEmpty(node) && node.parentNode) { // TODO improve / unify setCursorEnd
        return setCursor(node.parentElement, childNodeIndex(node));
    }
    return setCursor(node, 0);
}

export function setCursorEnd(node) {
    node = latestChild(node);
    if (isVisibleEmpty(node) && node.parentNode) { // TODO improve / unify setCursorEnd
        return setCursor(node.parentElement, childNodeIndex(node) + (isFakeLineBreak(node) ? 0 : 1));
    }
    return setCursor(node, nodeSize(node));
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
 * Returns whether or not the given node is a BR element which really acts as a
 * line break, not as a placeholder for the cursor.
 */
export function isRealLineBreak(node) {
    return (node instanceof HTMLBRElement
        && (findVisibleTextNode(rightDeepOnlyInlinePath(...rightPos(node)))
            || findNode(rightDeepOnlyInlinePath(...rightPos(node)), node => node instanceof HTMLBRElement)));
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
/**
 * Moves the given nodes to the given destination element.
 * That destination element is prepared first and adapted if necessary. The
 * cursor is then placed inside, before the moved elements.
 *
 * @param {HTMLElement} destinationEl
 * @param {number} destinationOffset
 * @param {HTMLElement} sourceEl
 * @param {number} [startIndex=0]
 * @param {number} [endIndex=sourceEl.childNodes.length]
 * @returns {Array.<HTMLElement, number} The position at the left of the moved
 *     nodes after the move was done (and where the cursor was repositioned).
 */
export function moveMergedNodes(destinationEl, destinationOffset, sourceEl, startIndex = 0, endIndex = sourceEl.childNodes.length) {
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

    // Replace cursor before the first moved node that remains after restore.
    const firstNode = nodes.find(node => !!node.parentNode);
    let pos;
    if (firstNode) {
        const leftNode = leftDeepOnlyInlinePath(...leftPos(firstNode)).next().value;
        if (leftNode) {
            pos = setCursorEnd(leftNode);
        } else {
            pos = setCursorStart(firstNode);
        }
    } else {
        pos = setCursorEnd(destinationEl.childNodes[destinationOffset - 1] || destinationEl);
    }

    return pos;
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
 *     multiple preparations with only one restore callback returned.
 * @returns {function}
 */
const directions = [DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
export function prepareUpdate(el, offset, ...args) {
    const positions = [...arguments];

    // Check the state in each direction starting from each position.
    const restoreData = [];
    while (positions.length) {
        el = positions.shift();
        offset = positions.shift();
        for (const direction of directions) {
            restoreData.push(getState(el, offset, direction));
        }
    }

    // Create the callback that will be able to restore the state in each
    // direction wherever the node in the opposite direction has landed.
    return function restoreStates() {
        for (const data of restoreData) {
            restoreState(data);
        }
    };
}

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
export function getState(el, offset, direction) {
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
    let leftCType;
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
                if (expr.test(value) && leftCType === undefined) {
                    const data = getState(...leftPos(node), DIRECTIONS.LEFT);
                    leftCType = data.cType;
                    if (leftCType & CTGROUPS.INLINE || leftCType & CTGROUPS.BR && direction === DIRECTIONS.RIGHT) {
                        cType = CTYPES.SPACE;
                        break;
                    }
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
        // collapsed.
        {cType1: CTYPES.CONTENT, cType2: CTYPES.SPACE | CTYPES.BLOCK_INSIDE | CTYPES.BR},
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
        // Remove space at the end of block after content once content is put
        // after it (otherwise it would become visible).
        {cType1: CTYPES.BLOCK_INSIDE, cType2: CTGROUPS.INLINE | CTGROUPS.BR},
        {spaceVisibility: false},
    ],
    [
        // Duplicate a BR once the content afterwards disappears
        {direction: DIRECTIONS.RIGHT, cType1: CTGROUPS.INLINE, cType2: CTYPES.BLOCK_INSIDE},
        {brVisibility: true},
    ],
    [
        // Remove a BR at the end of a block once inline content is put after
        // it (otherwise it would act as a line break).
        {direction: DIRECTIONS.RIGHT, cType1: CTYPES.BLOCK_INSIDE, cType2: CTGROUPS.INLINE},
        {brVisibility: false},
    ],
    [
        // Remove trailing BR (now or still faces a block boundary).
        {direction: DIRECTIONS.RIGHT, cType2: CTGROUPS.BLOCK},
        {brVisibility: false},
    ],
    [
        // Remove a BR once the BR that preceeds it is now replaced by
        // content.
        {direction: DIRECTIONS.LEFT, cType1: CTGROUPS.BR, cType2: CTGROUPS.INLINE},
        {brVisibility: false},
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
    if (Object.values(rule).filter(x => x !== undefined).length) {
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
                // We found a BR that we were asked to remove. Disobey if the
                // BR is between a space and a block or between a BR and a block
                // or between content and a BR (because in that case, this is a
                // BR which makes it visible).
                // TODO I'd like this to not be needed, it feels wrong...
                const {cType: leftCType} = getState(...leftPos(node), DIRECTIONS.LEFT);
                const {cType: rightCType} = getState(...rightPos(node), DIRECTIONS.RIGHT);
                if (!(leftCType & (CTYPES.BR | CTYPES.SPACE) && rightCType & CTGROUPS.BLOCK
                        || leftCType & CTGROUPS.INLINE && rightCType & CTGROUPS.BR)) {
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
        spaceNode.nodeValue = spaceNode.nodeValue.replace(expr, rule.spaceVisibility ? '\u00A0' : '');
    }
}
