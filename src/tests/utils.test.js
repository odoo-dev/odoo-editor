import {
    ancestors,
    boundariesIn,
    boundariesOut,
    childNodeIndex,
    closestBlock,
    closestElement,
    endPos,
    firstLeaf,
    getAdjacentPreviousSiblings,
    getAdjacentNextSiblings,
    getAdjacents,
    isVisible,
    isVisibleStr,
    lastLeaf,
    leftPos,
    nextLeaf,
    nodeSize,
    previousLeaf,
    rightPos,
    startPos,
} from '../utils/utils.js';

const insertTestHtml = innerHtml => {
    const container = document.createElement('DIV');
    container.innerHTML = innerHtml;
    document.body.appendChild(container);
    return container.childNodes;
};

describe('Utils', () => {
    //------------------------------------------------------------------------------
    // Position and sizes
    //------------------------------------------------------------------------------

    describe('leftPos', () => {
        it('should return the left position of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = leftPos(a);
            window.chai.expect(result).to.eql([p, 0]);
        });
        it('should return the left position of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = leftPos(b);
            window.chai.expect(result).to.eql([p, 0]);
        });
        it('should return the left position of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = leftPos(b);
            window.chai.expect(result).to.eql([p, 1]);
        });
        it('should return the left position of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = leftPos(i);
            window.chai.expect(result).to.eql([p, 3]);
        });
    });
    describe('rightPos', () => {
        it('should return the right position of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = rightPos(a);
            window.chai.expect(result).to.eql([p, 1]);
        });
        it('should return the right position of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = rightPos(b);
            window.chai.expect(result).to.eql([p, 1]);
        });
        it('should return the right position of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = rightPos(b);
            window.chai.expect(result).to.eql([p, 2]);
        });
        it('should return the right position of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = rightPos(i);
            window.chai.expect(result).to.eql([p, 4]);
        });
    });
    describe('boundariesOut', () => {
        it('should return the outside bounds of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = boundariesOut(a);
            window.chai.expect(result).to.eql([p, 0, p, 1]);
        });
        it('should return the outside bounds of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = boundariesOut(b);
            window.chai.expect(result).to.eql([p, 0, p, 1]);
        });
        it('should return the outside bounds of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = boundariesOut(b);
            window.chai.expect(result).to.eql([p, 1, p, 2]);
        });
        it('should return the outside bounds of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = boundariesOut(i);
            window.chai.expect(result).to.eql([p, 3, p, 4]);
        });
    });
    describe('startPos', () => {
        it('should return the start position of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = startPos(a);
            window.chai.expect(result).to.eql([a, 0]);
        });
        it('should return the start position of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = startPos(b);
            window.chai.expect(result).to.eql([b, 0]);
        });
        it('should return the start position of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = startPos(b);
            window.chai.expect(result).to.eql([b, 0]);
        });
        it('should return the start position of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = startPos(i);
            window.chai.expect(result).to.eql([i, 0]);
        });
    });
    describe('endPos', () => {
        it('should return the end position of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = endPos(a);
            window.chai.expect(result).to.eql([a, 1]);
        });
        it('should return the end position of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = endPos(b);
            window.chai.expect(result).to.eql([b, 1]);
        });
        it('should return the end position of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = endPos(b);
            window.chai.expect(result).to.eql([b, 1]);
        });
        it('should return the end position of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = endPos(i);
            window.chai.expect(result).to.eql([i, 1]);
        });
    });
    describe('boundariesIn', () => {
        it('should return the inside bounds of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const a = p.firstChild;
            const result = boundariesIn(a);
            window.chai.expect(result).to.eql([a, 0, a, 1]);
        });
        it('should return the inside bounds of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            const b = p.childNodes[0];
            const result = boundariesIn(b);
            window.chai.expect(result).to.eql([b, 0, b, 1]);
        });
        it('should return the inside bounds of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            const b = p.childNodes[1];
            const result = boundariesIn(b);
            window.chai.expect(result).to.eql([b, 0, b, 1]);
        });
        it('should return the inside bounds of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            const i = p.childNodes[3];
            const result = boundariesIn(i);
            window.chai.expect(result).to.eql([i, 0, i, 1]);
        });
    });
    describe('childNodeIndex', () => {
        it('should return the index of a lonely text node', () => {
            const [p] = insertTestHtml('<p>a</p>');
            p.childNodes.forEach((child, index) => {
                window.chai.expect(childNodeIndex(child)).to.equal(index);
            });
        });
        it('should return the index of an inline element', () => {
            const [p] = insertTestHtml('<p><b>a</b></p>');
            p.childNodes.forEach((child, index) => {
                window.chai.expect(childNodeIndex(child)).to.equal(index);
            });
        });
        it('should return the index of an inline element with whitespace', () => {
            const [p] = insertTestHtml(
                `<p>
                    <b>a</b>
                </p>`,
            );
            p.childNodes.forEach((child, index) => {
                window.chai.expect(childNodeIndex(child)).to.equal(index);
            });
        });
        it('should return the index of sibling-rich inline element', () => {
            const [p] = insertTestHtml(
                `<p>
                    abc<b>def</b>ghi<i>jkl</i><span><u>mno</u></span>pqr
                </p>`,
            );
            p.childNodes.forEach((child, index) => {
                window.chai.expect(childNodeIndex(child)).to.equal(index);
            });
        });
    });
    describe('nodeSize', () => {
        it('should return the size of a simple element', () => {
            const [p] = insertTestHtml('<p>a</p>');
            const result = nodeSize(p);
            window.chai.expect(result).to.equal(1);
        });
        it('should return the size of a text node', () => {
            const [p] = insertTestHtml('<p>abc</p>');
            const result = nodeSize(p.firstChild);
            window.chai.expect(result).to.equal(3);
        });
        it('should return the size of a child-rich element', () => {
            const [p] = insertTestHtml(
                `<p>
                    a<b>bc</b>d<i>ef</i>
                </p>`,
            );
            const result = nodeSize(p);
            window.chai.expect(result).to.equal(5);
        });
    });

    //------------------------------------------------------------------------------
    // DOM Path and node search functions
    //------------------------------------------------------------------------------

    // TODO: test path functions:
    // - closestPath
    // - leftDeepFirstPath
    // - leftDeepOnlyPath
    // - leftDeepFirstInlinePath
    // - leftDeepOnlyInlinePath
    // - leftDeepOnlyInlineInScopePath
    // - rightDeepFirstPath
    // - rightDeepOnlyPath
    // - rightDeepFirstInlinePath
    // - rightDeepOnlyInlinePath
    // - rightDeepOnlyInlineInScopePath
    // - findNode
    // - createDOMPathGenerator
    describe('closestElement', () => {
        it('should find the closest element to a text node', () => {
            const [div] = insertTestHtml('<div><p>abc</p></div>');
            const p = div.firstChild;
            const abc = p.firstChild;
            const result = closestElement(abc);
            window.chai.expect(result).to.equal(p);
        });
        it('should find that the closest element to an element is itself', () => {
            const [p] = insertTestHtml('<p>abc</p>');
            const result = closestElement(p);
            window.chai.expect(result).to.equal(p);
        });
    });
    describe('ancestors', () => {
        it('should find all the ancestors of a text node', () => {
            const [div] = insertTestHtml(
                '<div><div><div><p>abc</p><div><p>def</p></div></div></div></div>',
            );
            const editable = div.parentElement;
            const abcAncestors = [
                editable,
                div,
                div.firstChild,
                div.firstChild.firstChild,
                div.firstChild.firstChild.firstChild,
            ].reverse();
            const abc = abcAncestors[0].firstChild;
            const result = ancestors(abc, editable);
            window.chai.expect(result).to.eql(abcAncestors);
        });
        it('should find only the editable', () => {
            const [p] = insertTestHtml('<p>abc</p>');
            const editable = p.parentElement;
            const result = ancestors(p, editable);
            window.chai.expect(result).to.eql([editable]);
        });
    });
    describe('closestBlock', () => {
        it('should find the closest block of a deeply nested text node', () => {
            const [div] = insertTestHtml(
                '<div><div><p>ab<b><i><u>cd</u></i></b>ef</p></div></div>',
            );
            const p = div.firstChild.firstChild;
            const cd = p.childNodes[1].firstChild.firstChild.firstChild;
            const result = closestBlock(cd);
            window.chai.expect(result).to.equal(p);
        });
        it('should find that the closest block to a block is itself', () => {
            const [div] = insertTestHtml('<div><div><p>ab</p></div></div>');
            const p = div.firstChild.firstChild;
            const result = closestBlock(p);
            window.chai.expect(result).to.equal(p);
        });
    });
    describe('lastLeaf', () => {
        it('should find the last leaf of a child-rich block', () => {
            const [div] = insertTestHtml(
                '<div><div><p>ab<span>cd</span><b><i><u>ef</u></i></b></p></div></div>',
            );
            const p = div.firstChild.firstChild;
            const ef = p.childNodes[2].firstChild.firstChild.firstChild;
            const result = lastLeaf(div);
            window.chai.expect(result).to.equal(ef);
        });
        it('should find that the last closest block descendant of a child-rich block is itself', () => {
            const [div] = insertTestHtml(
                '<div><div><p>ab<span>cd</span><b><i><u>ef</u></i></b></p></div></div>',
            );
            const result = lastLeaf(div, true);
            window.chai.expect(result).to.equal(div);
        });
        it('should find no last closest block descendant of a child-rich inline and return its last leaf instead', () => {
            const [div] = insertTestHtml(
                '<div><div><p>ab<span>cd</span><b><i><u>ef</u></i></b></p></div></div>',
            );
            const b = div.firstChild.firstChild.childNodes[2];
            const ef = b.firstChild.firstChild.firstChild;
            const result = lastLeaf(b, true);
            window.chai.expect(result).to.equal(ef);
        });
    });
    describe('firstLeaf', () => {
        it('should find the first leaf of a child-rich block', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b><i><u>ab</u></i></b><span>cd</span>ef</p></div></div>',
            );
            const p = div.firstChild.firstChild;
            const ab = p.firstChild.firstChild.firstChild.firstChild;
            const result = firstLeaf(div);
            window.chai.expect(result).to.equal(ab);
        });
        it('should find that the first closest block descendant of a child-rich block is itself', () => {
            const [div] = insertTestHtml(
                '<div><div><p>ab<span>cd</span><b><i><u>ef</u></i></b></p></div></div>',
            );
            const result = firstLeaf(div, true);
            window.chai.expect(result).to.equal(div);
        });
        it('should find no first closest block descendant of a child-rich inline and return its first leaf instead', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b><i><u>ab</u></i></b><span>cd</span>ef</p></div></div>',
            );
            const b = div.firstChild.firstChild.firstChild;
            const ab = b.firstChild.firstChild.firstChild;
            const result = firstLeaf(b, true);
            window.chai.expect(result).to.equal(ab);
        });
    });
    describe('previousLeaf', () => {
        it('should find the previous leaf of a deeply nested node', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b>ab<i>cd<u>ef</u>gh</i></b><span>ij</span>kl</p></div></div>',
            );
            const editable = div.parentElement;
            const p = div.firstChild.firstChild;
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const ij = p.childNodes[1].firstChild;
            const result = previousLeaf(ij, editable);
            window.chai.expect(result).to.equal(gh);
        });
        it('should find no previous leaf and return undefined', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b>ab<i>cd<u>ef</u>gh</i></b><span>ij</span>kl</p></div></div>',
            );
            const editable = div.parentElement;
            const p = div.firstChild.firstChild;
            const ab = p.firstChild.firstChild;
            const result = previousLeaf(ab, editable);
            window.chai.expect(result).to.equal(undefined);
        });
        it('should find the previous leaf of a deeply nested node, skipping invisible nodes', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p1 = div.childNodes[1].childNodes[1];
            const gh = p1.childNodes[1].childNodes[1].childNodes[2];
            const p2 = div.childNodes[1].childNodes[3];
            const ij = p2.childNodes[1].firstChild;
            const result = previousLeaf(ij, editable, true);
            window.chai.expect(result).to.equal(gh);
        });
        it('should find no previous leaf, skipping invisible nodes, and return undefined', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p1 = div.childNodes[1].childNodes[1];
            const ab = p1.childNodes[1].firstChild;
            const result = previousLeaf(ab, editable, true);
            window.chai.expect(result).to.equal(undefined);
        });
        it('should find the previous leaf of a deeply nested node to be whitespace', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p2 = div.childNodes[1].childNodes[3];
            const whitespace = p2.firstChild;
            const ij = p2.childNodes[1].firstChild;
            const result = previousLeaf(ij, editable);
            window.chai.expect(result).to.equal(whitespace);
            window.chai.expect(isVisibleStr(whitespace)).to.equal(false);
        });
    });
    describe('nextLeaf', () => {
        it('should find the next leaf of a deeply nested node', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b>ab<i>cd<u>ef</u>gh</i></b><span>ij</span>kl</p></div></div>',
            );
            const editable = div.parentElement;
            const p = div.firstChild.firstChild;
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const ij = p.childNodes[1].firstChild;
            const result = nextLeaf(gh, editable);
            window.chai.expect(result).to.equal(ij);
        });
        it('should find no next leaf and return undefined', () => {
            const [div] = insertTestHtml(
                '<div><div><p><b>ab<i>cd<u>ef</u>gh</i></b><span>ij</span>kl</p></div></div>',
            );
            const editable = div.parentElement;
            const p = div.firstChild.firstChild;
            const kl = p.childNodes[2];
            const result = nextLeaf(kl, editable);
            window.chai.expect(result).to.equal(undefined);
        });
        it('should find the next leaf of a deeply nested node, skipping invisible nodes', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p1 = div.childNodes[1].childNodes[1];
            const gh = p1.childNodes[1].childNodes[1].childNodes[2];
            const p2 = div.childNodes[1].childNodes[3];
            const ij = p2.childNodes[1].firstChild;
            const result = nextLeaf(gh, editable, true);
            window.chai.expect(result).to.equal(ij);
        });
        it('should find no next leaf, skipping invisible nodes, and return undefined', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p2 = div.childNodes[1].childNodes[3];
            const kl = p2.childNodes[2];
            const result = nextLeaf(kl, editable, true);
            window.chai.expect(result).to.equal(undefined);
        });
        it('should find the next leaf of a deeply nested node to be whitespace', () => {
            const [div] = insertTestHtml(
                `<div>
                    <div>
                        <p>
                            <b>ab<i>cd<u>ef</u>gh</i></b>
                        </p>
                        <p>
                            <span>ij</span>kl
                        </p>
                    </div>
                </div>`,
            );
            const editable = div.parentElement;
            const p2 = div.childNodes[1].childNodes[3];
            const kl = p2.childNodes[2];
            const whitespace = div.childNodes[1].childNodes[4];
            const result = nextLeaf(kl, editable);
            window.chai.expect(result).to.equal(whitespace);
            window.chai.expect(isVisibleStr(whitespace)).to.equal(false);
        });
    });
    describe('getAdjacentPreviousSiblings', () => {
        it('should find the adjacent previous siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const u = gh.previousSibling;
            const cd = u.previousSibling;
            const result = getAdjacentPreviousSiblings(gh);
            window.chai.expect(result).to.eql([u, cd]);
        });
        it('should find no adjacent previous siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const ij = p.firstChild.childNodes[1].childNodes[3].firstChild;
            const result = getAdjacentPreviousSiblings(ij);
            window.chai.expect(result).to.eql([]);
        });
        it('should find only the adjacent previous siblings of a deeply nested node that are elements', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const u = gh.previousSibling;
            const result = getAdjacentPreviousSiblings(
                gh,
                node => node.nodeType === Node.ELEMENT_NODE,
            );
            window.chai.expect(result).to.eql([u]);
        });
        it('should find only the adjacent previous siblings of a deeply nested node that are text nodes (none)', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const result = getAdjacentPreviousSiblings(
                gh,
                node => node.nodeType === Node.TEXT_NODE,
            );
            window.chai.expect(result).to.eql([]);
        });
    });
    describe('getAdjacentNextSiblings', () => {
        it('should find the adjacent next siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const span = gh.nextSibling;
            const kl = span.nextSibling;
            const result = getAdjacentNextSiblings(gh);
            window.chai.expect(result).to.eql([span, kl]);
        });
        it('should find no adjacent next siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const ij = p.firstChild.childNodes[1].childNodes[3].firstChild;
            const result = getAdjacentNextSiblings(ij);
            window.chai.expect(result).to.eql([]);
        });
        it('should find only the adjacent next siblings of a deeply nested node that are elements', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const span = gh.nextSibling;
            const result = getAdjacentNextSiblings(gh, node => node.nodeType === Node.ELEMENT_NODE);
            window.chai.expect(result).to.eql([span]);
        });
        it('should find only the adjacent next siblings of a deeply nested node that are text nodes (none)', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const result = getAdjacentNextSiblings(gh, node => node.nodeType === Node.TEXT_NODE);
            window.chai.expect(result).to.eql([]);
        });
    });
    describe('getAdjacents', () => {
        it('should find the adjacent siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const u = gh.previousSibling;
            const cd = u.previousSibling;
            const span = gh.nextSibling;
            const kl = span.nextSibling;
            const result = getAdjacents(gh);
            window.chai.expect(result).to.eql([cd, u, gh, span, kl]);
        });
        it('should find no adjacent siblings of a deeply nested node', () => {
            const [p] = insertTestHtml('<p><b>ab<i>cd<u>ef</u>gh<span>ij</span>kl</i>mn</b>op</p>');
            const ij = p.firstChild.childNodes[1].childNodes[3].firstChild;
            const result = getAdjacents(ij);
            window.chai.expect(result).to.eql([ij]);
        });
        it('should find the adjacent siblings of a deeply nested node that are elements', () => {
            const [p] = insertTestHtml(
                '<p><b>ab<i>cd<u>ef</u><span>gh</span><span>ij</span>kl</i>mn</b>op</p>',
            );
            const gh = p.firstChild.childNodes[1].childNodes[2];
            const u = gh.previousSibling;
            const span = gh.nextSibling;
            const result = getAdjacents(gh, node => node.nodeType === Node.ELEMENT_NODE);
            window.chai.expect(result).to.eql([u, gh, span]);
        });
        it('should return an empty array if the given node is not satisfying the given predicate', () => {
            const [p] = insertTestHtml(
                '<p><b>ab<i>cd<u>ef</u><a>gh</a>ij<span>kl</span>mn</i>op</b>qr</p>',
            );
            const a = p.querySelector('a');
            const result = getAdjacents(a, node => node.nodeType === Node.TEXT_NODE);
            window.chai.expect(result).to.eql([]);
        });
    });

    //------------------------------------------------------------------------------
    // DOM Info utils
    //------------------------------------------------------------------------------

    describe('isVisible', () => {
        describe('textNode', () => {
            it('should identify an invisible textnode at the beginning of a paragraph before an inline node', () => {
                const [p] = insertTestHtml('<p> <i>a</i></p>');
                const result = isVisible(p.firstChild);
                window.chai.expect(result).not.to.be.ok;
            });
            it('should identify invisible string space at the end of a paragraph after an inline node', () => {
                const [p] = insertTestHtml('<p><i>a</i> </p>');
                const result = isVisible(p.lastChild);
                window.chai.expect(result).not.to.be.ok;
            });
            it('should identify a single visible space in an inline node in the middle of a paragraph', () => {
                const [p] = insertTestHtml('<p>a<i> </i>b</p>');
                const result = isVisible(p.querySelector('i').firstChild);
                window.chai.expect(result).to.be.ok;
            });
            it('should identify a visible string with only one visible space in an inline node in the middle of a paragraph', () => {
                const [p] = insertTestHtml('<p>a<i>   </i>b</p>');
                const result = isVisible(p.querySelector('i').firstChild);
                window.chai.expect(result).to.be.ok;
            });
            it('should identify a visible space in the middle of a paragraph', () => {
                const [p] = insertTestHtml('<p></p>');
                // insert 'a b' as three separate text node inside p
                const textNodes = 'a b'.split('').map(char => {
                    const textNode = document.createTextNode(char);
                    p.appendChild(textNode);
                    return textNode;
                });
                const result = isVisible(textNodes[1]);
                window.chai.expect(result).to.be.ok;
            });
            it('should identify a visible string space in the middle of a paragraph', () => {
                const [p] = insertTestHtml('<p></p>');
                // inserts 'a', '   ' and  'b' as 3 separate text nodes inside p
                const textNodes = ['a', '   ', 'b'].map(char => {
                    const textNode = document.createTextNode(char);
                    p.appendChild(textNode);
                    return textNode;
                });
                const result = isVisible(textNodes[1]);
                window.chai.expect(result).to.be.ok;
            });
            it('should identify the first space in a series of spaces as in the middle of a paragraph as visible', () => {
                const [p] = insertTestHtml('<p></p>');
                // inserts 'a   b' as 5 separate text nodes inside p
                const textNodes = 'a   b'.split('').map(char => {
                    const textNode = document.createTextNode(char);
                    p.appendChild(textNode);
                    return textNode;
                });
                const result = isVisible(textNodes[1]);
                window.chai.expect(result).to.be.ok;
            });
            it('should identify the second space in a series of spaces in the middle of a paragraph as invisible', () => {
                const [p] = insertTestHtml('<p></p>');
                // inserts 'a   b' as 5 separate text nodes inside p
                const textNodes = 'a   b'.split('').map(char => {
                    const textNode = document.createTextNode(char);
                    p.appendChild(textNode);
                    return textNode;
                });
                const result = isVisible(textNodes[2]);
                window.chai.expect(result).not.to.be.ok;
            });
            it('should identify empty text node as invisible', () => {
                const [p] = insertTestHtml('<p></p>');
                // inserts 'a   b' as 5 separate text nodes inside p
                const textNode = document.createTextNode('');
                p.appendChild(textNode);
                const result = isVisible(textNode);
                window.chai.expect(result).not.to.be.ok;
            });
            it('should identify a space between to visible char in inline nodes as visible', () => {
                const [p] = insertTestHtml('<p><i>a</i> <i>b</i></p>');
                const textNode = p.firstChild.nextSibling;

                const result = isVisible(textNode);

                window.chai.expect(result).to.be.ok;
            });
        });
    });
});
