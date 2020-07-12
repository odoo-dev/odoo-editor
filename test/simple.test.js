import { testEditor, deleteForward } from './utils.js';

describe('DeleteForward', () => {
    it('should delete the first character in a paragraph', () => {
        testEditor({
            contentBefore: '<p>[]abc</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>[]bc</p>',
        });
    });
    it('should delete a character within a paragraph', () => {
        testEditor({
            contentBefore: '<p>a[]bc</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>a[]c</p>',
        });
    });
    it('should delete the last character in a paragraph', () => {
        testEditor({
            contentBefore: '<p>ab[]c</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>ab[]</p>',
        });
        testEditor({
            contentBefore: '<p>ab []c</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>ab&nbsp;[]</p>',
        });
    });
    it('should merge a paragraph into an empty paragraph', () => {
        testEditor({
            contentBefore: '<p>[]<br></p><p>abc</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>[]abc</p>',
        });
    });




});

mocha.run();
