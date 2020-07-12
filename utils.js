"use strict";

function parentsGet(node) {
    let parents = [];
    while (node) {
        parents.push(node);
        node = node.parent;
    }
    return parents;
}


export function commonParentGet(node1, node2) {
    if ((!node1) || (!node2)) return null;
    let n1p = parentsGet(ca);
    let n2p = parentsGet(node);
    while (n1p[1]==n2p[1]) {
        n1p.shift();
        n2p.shift();
    }
    return n1p[0];
}
