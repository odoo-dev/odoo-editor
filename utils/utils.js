"use strict";

function parentsGet(node) {
    let parents = [];
    while (node) {
        parents.push(node);
        node = node.parent;
    }
    return parents;
}


// export function commonParentGet(node1, node2) {
//     if (!node1) return node2;
//     if (!node2) return node1;
//     if (node1==node2) return node1;
//     console.log('begin parent');
//     let n1p = parentsGet(node1);
//     let n2p = parentsGet(node2);
//     while (n1p[1]==n2p[1]) {
//         n1p.shift();
//         n2p.shift();
//     }
//     console.log('end parent');
//     return n1p[0];
// }

export function commonParentGet(node1, node2) {
    if ((!node1) || (!node2)) return null;
    let n1p = parentsGet(node1);
    let n2p = parentsGet(node2);
    while (n1p[1]==n2p[1]) {
        n1p.shift();
        n2p.shift();
    }
    return n1p[0];
}
