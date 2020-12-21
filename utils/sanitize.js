"use strict";

import {
    areSimilarElements,
    closestBlock,
    endPos,
    moveNodes,
} from "./utils.js";

class Sanitize {
    /**
     * @constructor
     */
    constructor(root) {
        // Specific tag cleanup
        this.tags = {};

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
            moveNodes(...endPos(node), node.nextSibling);
        }

        // FIXME not parse out of editable zone...
        this._parse(node.firstChild);
        this._parse(node.nextSibling);
    }
}

export function sanitize(root) {
    new Sanitize(root);
    return root;
}
