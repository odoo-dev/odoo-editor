"use strict";

export class Sanitize {
    constructor(root) {
        this.root = root;
        this.parse(root)
    }

    parse(node) {
        // console.log(node);
        if ((node.nodeType == 1) && (node.tagName in this.tags))
            this.tags[node.tagName](node);
        let cur = node.firstElementChild;
        while (cur) {
            this.parse(cur);
            cur = cur.nextElementSibling;
        }
        return node;
    }

    tags = {
        BR: (node) => {
            // <p>ab<br/></p> -->  <p>ab</p>
            if ((!node.nextSibling) && (node.previousSibling && node.previousSibling.tagName!='BR'))
                node.remove();
        },
    }
}



