"use strict";

import {
    areSimilarElements,
    childNodeIndex,
    closestBlock,
    findNode,
    findVisibleTextNode,
    isFakeLineBreak,
    isRealLineBreak,
    leftDeepOnlyInlinePath,
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
            if (node.nextSibling.childNodes.length) {
                moveMergedNodes(node, [...node.nextSibling.childNodes]);
            }
            node.nextSibling.remove();
        }

        // FIXME not parse out of editable zone...
        this._parse(node.firstChild);
        this._parse(node.nextSibling);
    }

    // Specific tag cleanup
    tags = {}
}

export function sanitize(root) {
    new Sanitize(root);
    return root;
}
