import { closestPath, findNode, setCursor } from "../utils/utils.js";

Text.prototype.oUnlink = function (offset, content) {
    const sel = document.defaultView.getSelection();
    if (sel.isCollapsed) {
        const node = findNode(closestPath(sel.anchorNode), node => node.tagName === "A");
        const anchorOffset = sel.anchorOffset;
        setCursor(node, 0, sel.focusNode, node.textContent.length);
        document.execCommand('unlink');
        setCursor(sel.anchorNode, anchorOffset, sel.focusNode, sel.focusOffset);
        sel.collapseToStart();
    } else {
        document.execCommand('unlink');
    }
};
