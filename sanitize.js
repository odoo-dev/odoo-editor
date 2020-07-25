"use strict";

import {isBlock} from "./utils/isBlock.js";

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
        if (node.nodeType == 1) {
            this._parse(node.firstChild, cleanup);
            if (node.tagName in this.tags)
                this.tags[node.tagName](node, cleanup);
        }
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



