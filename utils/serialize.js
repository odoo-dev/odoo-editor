// TODO: avoid empty keys when not necessary to reduce request size
export function nodeToObject(node) {
    let result = {
       nodeType: node.nodeType,
       oid: node.oid,
    }
    if (!node.oid) {
        console.log('OID can not be false!');
        debugger;
    }
    if (node.nodeType == Node.TEXT_NODE)
        result.textValue = node.nodeValue;
    if (node.nodeType == Node.ELEMENT_NODE) {
        result.tagName = node.tagName;
        result.children = [];
        result.attributes = {};
        for (let i=0; i < node.attributes.length; i++)
            result.attributes[node.attributes[i].name] = node.attributes[i].value;
        let child = node.firstChild;
        while (child) {
            result.children.push(nodeToObject(child));
            child = child.nextSibling;
        }
    }
    return result;
}


export function objectToNode(obj) {
    let result = undefined;
    if (obj.nodeType==Node.TEXT_NODE) {
        result = document.createTextNode(obj.textValue)
    } else if (obj.nodeType==Node.ELEMENT_NODE) {
        result = document.createElement(obj.tagName);
        for (let key in obj.attributes)
            result.setAttribute(key, obj.attributes[key]);
        obj.children.forEach(child => result.append(objectToNode(child)));
    } else
        alert('unknown node type');
    result.oid = obj.oid;
    return result
}

