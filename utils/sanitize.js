"use strict";

import {
    areSimilarElements,
    childNodeIndex,
    closestBlock,
    findPreviousInline,
    findVisibleTextPrevNode,
    isFakeLineBreak,
    isRealLineBreak,
    moveMergedNodes,
} from "./utils.js";

class Sanitize {
    /**
     * @constructor
     */
    constructor(root) {
        this.root = root;
        this.parse(root);
    }

    parse(node) {
        this._parse(closestBlock(node));
    }

    _parse(node) {
        if (!node) {
            return;
        }

        // Specific tag cleanup
        if (node.nodeType === node.ELEMENT_NODE && node.tagName in this.tags) {
            this.tags[node.tagName](node);
        }

        // Merge identical elements together
        if (areSimilarElements(node, node.nextSibling)) {
            const fragment = document.createDocumentFragment();
            // FIXME forced to add a clone for the duration of moveMergedNodes
            // so it can check the correct DOM state
            const tempCloneEl = node.nextSibling.cloneNode(true);
            node.nextSibling.after(tempCloneEl);
            while (node.nextSibling.firstChild) {
                fragment.appendChild(node.nextSibling.firstChild);
            }
            node.nextSibling.remove();
            // FIXME this handles the cursor but should probably only reposition
            // it if the cursor was in the merged element or just before
            moveMergedNodes(node, fragment);
            tempCloneEl.remove();
        }

        // FIXME not parse out of editable zone...
        this._parse(node.firstChild);
        this._parse(node.nextSibling);
    }

    // Specific tag cleanup
    tags = {
        BR: function (node) {
            const parentEl = node.parentNode;
            const index = childNodeIndex(node);
            // Remove trailing line breaks which do not act as a placeholder for
            // other BR or for container element.
            if (isFakeLineBreak(node)
                    && findVisibleTextPrevNode(parentEl, index)
                    && !findPreviousInline(parentEl, index, node => isRealLineBreak(node))) {
                node.remove();
            }
        }
    }
}

export function sanitize(root) {
    new Sanitize(root);
    return root;
}
