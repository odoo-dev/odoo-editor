"use strict";

import {Editor} from "../editor.js"

let Direction = {
    BACKWARD: 'BACKWARD',
    FORWARD: 'FORWARD',
}

function _nextNode(node) {
    let next = node.firstChild || node.nextSibling;
    if (!next) {
        next = node;
        while (next.parentNode && !next.nextSibling) {
            next = next.parentNode;
        }
        next = next && next.nextSibling;
    }
    return next;
}

function _toDomLocation(node, index) {
    let container;
    let offset;
    if (node.textContent.length) {
        container = node;
        offset = index;
    } else {
        container = node.parentNode;
        offset = Array.from(node.parentNode.childNodes).indexOf(node);
    }
    return [container, offset];
}

function _parseTextualSelection(testContainer) {
    let anchorNode;
    let anchorOffset;
    let focusNode;
    let focusOffset;
    let direction = Direction.FORWARD;

    let node = testContainer;
    while (node && !(anchorNode && focusNode)) {
        let next;
        if (node.nodeType === Node.TEXT_NODE) {
            // Look for special characters in the text content and remove them.
            const anchorIndex = node.textContent.indexOf("[");
            node.textContent = node.textContent.replace("[", '');
            const focusIndex = node.textContent.indexOf("]");
            node.textContent = node.textContent.replace("]", '');

            // Set the nodes and offsets if we found the selection characters.
            if (anchorIndex !== -1) {
                [anchorNode, anchorOffset] = _toDomLocation(node, anchorIndex);
                // If the focus node has already been found by this point then
                // it is before the anchor node, so the selection is backward.
                if (focusNode) {
                    direction = Direction.BACKWARD;
                }
            }
            if (focusIndex !== -1) {
                [focusNode, focusOffset] = _toDomLocation(node, focusIndex);
                // If the anchor character is within the same parent and is
                // after the focus character, then the selection is backward.
                // Adapt the anchorOffset to account for the focus character
                // that was removed.
                if (anchorNode === focusNode && anchorOffset > focusOffset) {
                    direction = Direction.BACKWARD;
                    anchorOffset--;
                }
            }

            // Get the next node to check.
            next = _nextNode(node);

            // Remove the textual range node if it is empty.
            if (!node.textContent.length) {
                node.parentNode.removeChild(node);
            }
        } else {
            next = _nextNode(node);
        }
        node = next;
    }
    if (anchorNode && focusNode) {
        return {
            anchorNode: anchorNode,
            anchorOffset: anchorOffset,
            focusNode: focusNode,
            focusOffset: focusOffset,
            direction: direction,
        };
    }
}

/**
 * Set a range in the DOM.
 *
 * @param selection
 */
export function setSelection(selection) {
    const domRange = document.createRange();
    if (selection.direction === Direction.FORWARD) {
        domRange.setStart(selection.anchorNode, selection.anchorOffset);
        domRange.collapse(true);
    } else {
        domRange.setEnd(selection.anchorNode, selection.anchorOffset);
        domRange.collapse(false);
    }
    const domSelection = selection.anchorNode.ownerDocument.getSelection();
    domSelection.removeAllRanges();
    domSelection.addRange(domRange);
    domSelection.extend(selection.focusNode, selection.focusOffset);
}

/**
 * Insert the given character at the given offset of the given container.
 *
 * @param char
 * @param container
 * @param offset
 */
function _insertCharAt(char, container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
        const startValue = container.nodeValue;
        container.nodeValue =
            startValue.slice(0, offset) + char + startValue.slice(offset, startValue.length);
    } else {
        container.parentNode.insertBefore(document.createTextNode(char), container);
    }
}

/**
 * Return the deepest child of a given container at a given offset, and its
 * adapted offset.
 *
 * @param container
 * @param offset
 */
export function targetDeepest(container, offset) {
    while (container.hasChildNodes()) {
        let childNodes;
        if (container instanceof Element && container.shadowRoot) {
            childNodes = container.shadowRoot.childNodes;
        } else {
            childNodes = container.childNodes;
        }
        if (offset >= childNodes.length) {
            container = container.lastChild;
            // The new container might be a text node, so considering only
            // the `childNodes` property would be wrong.
            offset = nodeLength(container);
        } else {
            container = childNodes[offset];
            offset = 0;
        }
    }
    return [container, offset];
}

/**
 * Insert in the DOM:
 * - `SELECTION_ANCHOR_CHAR` in place for the selection start
 * - `SELECTION_FOCUS_CHAR` in place for the selection end
 *
 * This is used in the function `testEditor`.
 */
export function renderTextualSelection() {
    const selection = document.getSelection();
    if (selection.rangeCount === 0) return;

    const anchor = targetDeepest(selection.anchorNode, selection.anchorOffset);
    const focus = targetDeepest(selection.focusNode, selection.focusOffset);

    // If the range characters have to be inserted within the same parent and
    // the anchor range character has to be before the focus range character,
    // the focus offset needs to be adapted to account for the first insertion.
    const [anchorNode, anchorOffset] = anchor;
    const [focusNode, baseFocusOffset] = focus;
    let focusOffset = baseFocusOffset;
    if (anchorNode === focusNode && anchorOffset <= focusOffset) {
        focusOffset++;
    }
    _insertCharAt('[', ...anchor);
    _insertCharAt(']', focusNode, focusOffset);
}


export async function testEditor(spec) {
    const testNode = document.createElement('div');
    document.body.appendChild(testNode);
    const editor = new Editor(testNode);

    console.log('ici');
    testNode.innerHTML = spec.contentBefore;
    let selection = _parseTextualSelection(testNode);
    if (selection) {
        setSelection(selection);
    } else {
        document.getSelection().removeAllRanges();
    }

    if (spec.stepFunction)
        await spec.stepFunction(editor);

    if (spec.contentAfter) {
        renderTextualSelection();
        const value = editor.dom.innerHTML;
        assert.equal(value, spec.contentAfter);
    }
    // testNode.remove()
}

export let deleteForward = async (editor) => {
    let event = new KeyboardEvent('keydown', {'keyCode':46});
    await editor.keyDown(event);
};
