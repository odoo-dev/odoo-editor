"use strict";

function parentsGet(node, root=undefined) {
    let parents = [];
    while (node) {
        parents.unshift(node);
        if (node == root) break;
        node = node.parentNode;
    }
    return parents;
}

export function commonParentGet(node1, node2, root=undefined) {
    if ((!node1) || (!node2)) return null;
    let n1p = parentsGet(node1, root);
    let n2p = parentsGet(node2, root);
    while ((n1p.length>1) && (n1p[1]==n2p[1])) {
        n1p.shift();
        n2p.shift();
    }
    return n1p[0];
}


// TODO: improve to include the :before/:after {content: ...} like fa- or <br/>
export function hasContentAfter(node) {
    return node && (hasContent(node) || hasContentAfter(node.nextElementSibling) || hasContentAfter(node.firstElementChild));
}

// TODO: improve performance (avoid recursive textContent that is already 
export function hasContent(node) {
    if (!node)
        return false;
    if (node.nodeType == node.ELEMENT_NODE) {
        if (getComputedStyle(node, ':before').getPropertyValue('content') || getComputedStyle(node, ':after').getPropertyValue('content'))
            return true;
    }
    return !!node.textContent.replace(/[ \t\n]+$/, '');
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
    return ['b','u','i', 'strong', 'strong', 'em', 'strike'].includes(node.tagName);
}
