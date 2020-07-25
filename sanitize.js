"use strict";

import {isBlock} from "./utils/isBlock.js";
import {isSimilarNode} from "./utils/utils.js";

export class Sanitize {
    constructor(root) {
        this.root = root;
        this.parse(root)
    }

    parse(node, cleanup=false) {
        let parentBlock = node;
        while (! isBlock(parentBlock) )
            parentBlock = parentBlock.parent;
        this._parse(node, cleanup);
    }

    _parse(node, cleanup=false) {
        if (!node) return;
        if (node.nodeType == node.ELEMENT_NODE) {
            if (node.tagName in this.tags)
                this.tags[node.tagName](node, cleanup);
        }

        // merge identitcal nodes
        if (isSimilarNode(node, node.nextSibling) && !isBlock(node)) {
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

        if (node.nodeType == node.ELEMENT_NODE)
            this._parse(node.firstChild, cleanup);
        this._parse(node.nextSibling, cleanup);
    }


    tags = {
        BR: (node, cleanup) => {
            // <p>ab<br/></p> -->  <p>ab</p>
            if ((!node.nextSibling) && (node.previousSibling && node.previousSibling.tagName!='BR'))
                node.remove();
        },
        P: (node, cleanup) => {
            // <p></p> -->  <p><br/></p>
            if (!node.firstChild)
                node.innerHTML = '<br/>';
        }
    }
}



