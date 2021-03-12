import {
    boundariesIn,
    boundariesOut,
    childNodeIndex,
    endPos,
    isVisible,
    leftPos,
    nodeSize,
    rightPos,
    startPos,
} from '../utils/utils.js';

const insertTestHtml = innerHtml => {
    const container = document.createElement('DIV');
    container.innerHTML = innerHtml;
    document.body.appendChild(container);
    return container.childNodes;
};

describe.only('Utils', () => {
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
    // TODO: test path functions.
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
