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
    let n1p = parentsGet(node1);
    let n2p = parentsGet(node2);
    while (n1p[1]==n2p[1]) {
        n1p.shift();
        n2p.shift();
    }
    return n1p[0];
}

// TODO: improve to include the :before/:after {content: ...} like fa- or <br/>
export function hasContentAfter(node) {
    let node2 = node;
    while (node2.nextSibling) {
        node2 = node2.nextSibling;
        if (node2.nodeType == node2.TEXT_NODE) {
            if (node.nodeValue.replace(/[ \t]+$/, ''))
                return true;
        } else {
            if (hasContentAfter(node2))
                return true;
        }
    }
    return false;
}


export function isSimilarNode(node, node2) {
    if ((!node2) || node.nodeType != node2.nodeType)
        return false;
    if (node.nodeType == node.ELEMENT_NODE) {
        if (node.tagName != node2.tagName)
            return false
        for (let att in node.attributes) {
            if (node[att] != node2[att])
                return false;
        }
        for (let att in node2.attributes) {
            if (node[att] != node2[att])
                return false;
        }
    }
    return true;
}
