import { isVisible } from '../utils/utils.js';

const insertTestHtml = innerHtml => {
    const container = document.createElement('DIV');
    container.innerHTML = innerHtml;
    document.body.appendChild(container);
    return container.childNodes;
};

describe('Utils', () => {
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
