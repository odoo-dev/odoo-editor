"use strict";

import {isBlock} from "./utils/isBlock.js";
import {isSimilarNode, hasContentAfter} from "./utils/utils.js";

class Sanitize {
    constructor(root) {
        this.root = root;
        this.parse(root)
    }

    parse(node, cleanup=false) {
        while (! isBlock(node) )
            node = node.parentNode;
        this._parse(node, cleanup);
    }

    _parse(node, cleanup=false) {
        if (!node) return;
        if (node.nodeType == node.ELEMENT_NODE) {
            if (node.tagName in this.tags)
                this.tags[node.tagName](node, cleanup);
        }

        // merge identitcal nodes
        if (isSimilarNode(node, node.nextSibling)) {
            if ((node.nodeType == node.ELEMENT_NODE)
              && !getComputedStyle(node, ':before').getPropertyValue('content')
              && !getComputedStyle(node, ':after').getPropertyValue('content'))
            {
                let sel = document.defaultView.getSelection();
                while (node.nextSibling.firstChild)
                    node.append(node.nextSibling.firstChild);

                // move slection anchor if needed
                if (sel.anchorNode == node.nextSibling) {
                    debugger;
                }
                node.nextSibling.remove();
            }
        }

        // TOOD: <li> must be in a <ul> or <ol> as the code is not fault tolerant
        // to implement: cleaning

        if (node.nodeType == node.ELEMENT_NODE)
            this._parse(node.firstChild, cleanup);
        this._parse(node.nextSibling, cleanup);
    }


    tags = {
        // example
        // P: (node, cleanup) => {
        //     if (!node.firstChild)
        //         node.innerHTML = '<br/>';
        // }
    }
}


export function sanitize(root) {
    new Sanitize(root);
    return root;
}
