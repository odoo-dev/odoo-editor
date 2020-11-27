"use strict";

import {
    BasicEditor,
    deleteBackward,
    insertParagraphBreak,
    testEditor,
} from './utils.js';

describe('Editor', () => {
    describe('deleteBackward', () => {
        describe('Selection collapsed', () => {
            describe('Basic', () => {
                it('should do nothing', async () => {
                    // TODO the addition of <br/> "correction" part was judged
                    // unnecessary to enforce, the rest of the test still makes
                    // sense: not removing the unique <p/> and keeping the
                    // cursor at the right place.
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>[]</p>',
                    });
                    // TODO non-collapsed in collapsed... to see later
                    // await testEditor(BasicEditor, {
                    //     contentBefore: '<p>[<br>]</p>',
                    //     stepFunction: deleteBackward,
                    //     // The <br> is there only to make the <p> visible.
                    //     // It does not exist in VDocument and selecting it
                    //     // has no meaning in the DOM.
                    //     contentAfter: '<p>[]<br></p>',
                    // });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]abc</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>[]abc</p>',
                    });
                });
                it('should delete the first character in a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>a[]bc</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>[]bc</p>',
                    });
                });
                it('should delete a character within a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]c</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>a[]c</p>',
                    });
                });
                it('should delete the last character in a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[]</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab c[]</p>',
                        stepFunction: deleteBackward,
                        // The space should be converted to an unbreakable space
                        // so it is visible.
                        contentAfter: '<p>ab&nbsp;[]</p>',
                    });
                });
                it('should merge a paragraph into an empty paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><br></p><p>[]abc</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>[]abc</p>',
                    });
                });
                it('should not break unbreakables', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<table><tbody><tr><td>[]<br></td><td>abc</td></tr></tbody></table>',
                        stepFunction: deleteBackward,
                        contentAfter:
                            '<table><tbody><tr><td>[]<br></td><td>abc</td></tr></tbody></table>',
                    });
                });
            });
            describe('Line breaks', () => {
                describe('Single', () => {
                    it('should delete a leading line break', async () => {
                        await testEditor(BasicEditor, {
                            contentBefore: '<p><br>[]abc</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>[]abc</p>',
                        });
                        await testEditor(BasicEditor, {
                            contentBefore: '<p><br>[] abc</p>',
                            stepFunction: deleteBackward,
                            // The space after the <br> is expected to be parsed
                            // away, like it is in the DOM.
                            contentAfter: '<p>[]abc</p>',
                        });
                    });
                    it('should delete a line break within a paragraph', async () => {
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab<br>[]cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab[]cd</p>',
                        });
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab <br>[]cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab []cd</p>',
                        });
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab<br>[] cd</p>',
                            stepFunction: deleteBackward,
                            // The space after the <br> is expected to be parsed
                            // away, like it is in the DOM.
                            contentAfter: '<p>ab[]cd</p>',
                        });
                    });
                    it('should delete a trailing line break', async () => {
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>abc<br><br>[]</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>abc[]</p>',
                        });
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>abc<br>[]<br></p>',
                            stepFunction: deleteBackward,
                            // This should be identical to the one before.
                            contentAfter: '<p>abc[]</p>',
                        });
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>abc <br><br>[]</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>abc&nbsp;[]</p>',
                        });
                    });
                    it('should delete a character and a line break, emptying a paragraph', async () => {
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>aaa</p><p><br>a[]</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>aaa</p><p>[]<br></p>',
                        });
                    });
                    it('should delete a character after a trailing line break', async () => {
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab<br>c[]</p>',
                            stepFunction: deleteBackward,
                            // A new <br> should be insterted, to make the first one
                            // visible.
                            contentAfter: '<p>ab<br>[]<br></p>',
                        });
                    });
                });
                describe('Consecutive', () => {
                    it('should merge a paragraph with 4 <br> into a paragraph with text', async () => {
                        // 1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p>[]<br><br><br><br></p><p>cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab[]<br><br><br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete a line break', async () => {
                        // 2-1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br>[]<br><br><br></p><p>cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab</p><p>[]<br><br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete a line break, then merge a paragraph with 3 <br> into a paragraph with text', async () => {
                        // 2-2
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br>[]<br><br><br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab[]<br><br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete a line break', async () => {
                        // 3-1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br>[]<br><br></p><p>cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab</p><p><br>[]<br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete two line breaks', async () => {
                        // 3-2
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br>[]<br><br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab</p><p>[]<br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete two line breaks, then merge a paragraph with 3 <br> into a paragraph with text', async () => {
                        // 3-3
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br>[]<br><br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab[]<br><br></p><p>cd</p>',
                        });
                    });
                    it('should delete a line break', async () => {
                        // 4-1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br>[]<br></p><p>cd</p>',
                            stepFunction: deleteBackward,
                            // A trailing line break is rendered as two <br>.
                            contentAfter: '<p>ab</p><p><br><br>[]<br></p><p>cd</p>',
                        });
                        // 5-1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br>[]</p><p>cd</p>',
                            stepFunction: deleteBackward,
                            // This should be identical to 4-1
                            contentAfter: '<p>ab</p><p><br><br>[]<br></p><p>cd</p>',
                        });
                    });
                    it('should delete two line breaks', async () => {
                        // 4-2
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br>[]<br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            // A trailing line break is rendered as two <br>.
                            contentAfter: '<p>ab</p><p><br>[]<br></p><p>cd</p>',
                        });
                        // 5-2
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br>[]</p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            // This should be identical to 4-2
                            contentAfter: '<p>ab</p><p><br>[]<br></p><p>cd</p>',
                        });
                    });
                    it('should delete three line breaks (emptying a paragraph)', async () => {
                        // 4-3
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br>[]<br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab</p><p>[]<br></p><p>cd</p>',
                        });
                        // 5-3
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br>[]</p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            // This should be identical to 4-3
                            contentAfter: '<p>ab</p><p>[]<br></p><p>cd</p>',
                        });
                    });
                    it('should delete three line breaks, then merge an empty parargaph into a paragraph with text', async () => {
                        // 4-4
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br>[]<br></p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            // This should be identical to 4-4
                            contentAfter: '<p>ab[]</p><p>cd</p>',
                        });
                        // 5-4
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br>[]</p><p>cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab[]</p><p>cd</p>',
                        });
                    });
                    it('should merge a paragraph into a paragraph with 4 <br>', async () => {
                        // 6-1
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br></p><p>[]cd</p>',
                            stepFunction: deleteBackward,
                            contentAfter: '<p>ab</p><p><br><br><br>[]cd</p>',
                        });
                    });
                    it('should merge a paragraph into a paragraph with 4 <br>, then delete a trailing line break', async () => {
                        // 6-2
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br></p><p>[]cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab</p><p><br><br>[]cd</p>',
                        });
                    });
                    it('should merge a paragraph into a paragraph with 4 <br>, then delete two line breaks', async () => {
                        // 6-3
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br></p><p>[]cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab</p><p><br>[]cd</p>',
                        });
                    });
                    it('should merge a paragraph into a paragraph with 4 <br>, then delete three line breaks', async () => {
                        // 6-4
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br></p><p>[]cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab</p><p>[]cd</p>',
                        });
                    });
                    it('should merge a paragraph into a paragraph with 4 <br>, then delete three line breaks, then merge two paragraphs with text', async () => {
                        // 6-5
                        await testEditor(BasicEditor, {
                            contentBefore: '<p>ab</p><p><br><br><br><br></p><p>[]cd</p>',
                            stepFunction: async (editor) => {
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                                await deleteBackward(editor);
                            },
                            contentAfter: '<p>ab[]cd</p>',
                        });
                    });
                });
            });
            describe('Formats', () => {
                it('should delete a character before a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc<b>[]def</b></p>',
                        stepFunction: deleteBackward,
                        // The selection is normalized so we only have one way
                        // to represent a position.
                        contentAfter: '<p>ab[]<b>def</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[]<b>def</b></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]<b>def</b></p>',
                    });
                });
            });
            describe('Merging different types of elements', () => {
                it('should merge a paragraph with text into a paragraph with text', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab</p><p>[]cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                });
                it('should merge a paragraph with formated text into a paragraph with text', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>aa</p><p>[]a<i>bbb</i></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>aa[]a<i>bbb</i></p>',
                    });
                });
                it('should merge a paragraph with text into a heading1 with text', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<h1>ab</h1><p>[]cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<h1>ab[]cd</h1>',
                    });
                });
                it('should merge an empty paragraph into a heading1 with text', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<h1>ab</h1><p>[]<br></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<h1>ab[]</h1>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<h1>ab</h1><p>[<br>]</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<h1>ab[]</h1>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<h1>ab</h1><p><br>[]</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<h1>ab[]</h1>',
                    });
                });
                it('should merge a heading1 with text into an empty paragraph (keeping the heading)', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><br></p><h1>[]ab</h1>',
                        stepFunction: deleteBackward,
                        contentAfter: '<h1>[]ab</h1>',
                    });
                });
                it('should merge with previous node (default behaviour)', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<jw-block-a>a</jw-block-a><jw-block-b>[]b</jw-block-b>',
                        stepFunction: deleteBackward,
                        contentAfter: '<jw-block-a>a[]b</jw-block-a>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<jw-block-a>a</jw-block-a><jw-block-b>[<br>]</jw-block-b>',
                        stepFunction: deleteBackward,
                        contentAfter: '<jw-block-a>a[]</jw-block-a>',
                    });
                });
                it('should merge nested elements (default behaviour)', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<jw-block-a><jw-block-b>ab</jw-block-b></jw-block-a><jw-block-c><jw-block-d>[]cd</jw-block-d></jw-block-c>',
                        stepFunction: deleteBackward,
                        contentAfter: '<jw-block-a><jw-block-b>ab[]cd</jw-block-b></jw-block-a>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<jw-block-a><jw-block-b>ab</jw-block-b></jw-block-a><jw-block-c><jw-block-d>[<br>]</jw-block-d></jw-block-c>',
                        stepFunction: deleteBackward,
                        contentAfter: '<jw-block-a><jw-block-b>ab[]</jw-block-b></jw-block-a>',
                    });
                });
                it('should not break unbreakables', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<table><tbody><tr><td><br></td><td>[]abc</td></tr></tbody></table>',
                        stepFunction: deleteBackward,
                        contentAfter:
                            '<table><tbody><tr><td><br></td><td>[]abc</td></tr></tbody></table>',
                    });
                });
                it('should merge a text preceding a paragraph (removing the paragraph)', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: 'ab<p>[]cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: 'ab[]cd',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: 'ab<p>[]cd</p>ef',
                        stepFunction: deleteBackward,
                        contentAfter: 'ab[]cdef',
                    });
                });
            });
            describe('With attributes', () => {
                it('should merge a paragraph without class into an empty paragraph with a class', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p class="a"><br></p><p>[]abc</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>[]abc</p>',
                    });
                });
                it('should merge two paragraphs with spans of same classes', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p><span class="a">ab</span></p><p><span class="a">[]cd</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p><span class="a">ab[]cd</span></p>',
                    });
                });
                it('should merge two paragraphs with spans of different classes without merging the spans', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p><span class="a">ab</span></p><p><span class="b">[]cd</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p><span class="a">ab[]</span><span class="b">cd</span></p>',
                    });
                });
                it('should merge two paragraphs of different classes, each containing spans of the same class', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p class="a"><span class="b">ab</span></p><p class="c"><span class="b">[]cd</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p class="a"><span class="b">ab[]cd</span></p>',
                    });
                });
                it('should merge two paragraphs of different classes, each containing spans of different classes without merging the spans', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p class="a"><span class="b">ab</span></p><p class="c"><span class="d">[]cd</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter:
                            '<p class="a"><span class="b">ab[]</span><span class="d">cd</span></p>',
                    });
                });
                it('should delete a line break between two spans with bold and merge these formats', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><span><b>ab</b></span><br/><span><b>[]cd</b></span></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p><span><b>ab[]cd</b></span></p>',
                    });
                });
                it('should delete a character in a span with bold, then a line break between two spans with bold and merge these formats', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p><span><b>ab<br></b></span><br><span><b>c[]de</b></span></p>',
                        stepFunction: async (editor) => {
                            await deleteBackward(editor);
                            await deleteBackward(editor);
                        },
                        contentAfter: '<p><span><b>ab<br>[]de</b></span></p>',
                    });
                });
            });
        });
    });

    describe('insertParagraphBreak', () => {
        describe('Selection collapsed', () => {
            describe('Basic', () => {
                it('should duplicate an empty paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]<br></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[<br>]</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><br>[]</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p>[]<br></p>',
                    });
                });
                it('should insert an empty paragraph before a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]abc</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p>[]abc</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[] abc</p>',
                        stepFunction: insertParagraphBreak,
                        // The space should have been parsed away.
                        contentAfter: '<p><br></p><p>[]abc</p>',
                    });
                });
                it('should split a paragraph in two', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]cd</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p>ab</p><p>[]cd</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab []cd</p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible.
                        contentAfter: '<p>ab&nbsp;</p><p>[]cd</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[] cd</p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible.
                        contentAfter: '<p>ab</p><p>[]&nbsp;cd</p>',
                    });
                });
                it('should insert an empty paragraph after a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[]</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p>abc</p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[] </p>',
                        stepFunction: insertParagraphBreak,
                        // The space should have been parsed away.
                        contentAfter: '<p>abc</p><p>[]<br></p>',
                    });
                });
            });
            describe('Consecutive', () => {
                it('should duplicate an empty paragraph twice', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]<br></p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p><br></p><p><br></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[<br>]</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p><br></p><p><br></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><br>[]</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p><br></p><p><br></p><p>[]<br></p>',
                    });
                });
                it('should insert two empty paragraphs before a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]abc</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p><br></p><p><br></p><p>[]abc</p>',
                    });
                });
                it('should split a paragraph in three', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]cd</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p>ab</p><p><br></p><p>[]cd</p>',
                    });
                });
                it('should split a paragraph in four', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]cd</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p>ab</p><p><br></p><p><br></p><p>[]cd</p>',
                    });
                });
                it('should insert two empty paragraphs after a paragraph', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[]</p>',
                        stepFunction: async (editor) => {
                            await insertParagraphBreak(editor);
                            await insertParagraphBreak(editor);
                        },
                        contentAfter: '<p>abc</p><p><br></p><p>[]<br></p>',
                    });
                });
            });
            describe('Format', () => {
                it('should split a paragraph before a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc[]<b>def</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p>abc</p><p><b>[]def</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        // That selection is equivalent to []<b>
                        contentBefore: '<p>abc<b>[]def</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p>abc</p><p><b>[]def</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc <b>[]def</b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible (because it's after a
                        // <br>).
                        contentAfter: '<p>abc&nbsp;</p><p><b>[]def</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abc<b>[] def </b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible (because it's before a
                        // <br>).
                        contentAfter: '<p>abc</p><p><b>[]&nbsp;def</b></p>',
                    });
                });
                it('should split a paragraph after a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>abc</b>[]def</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><b>abc</b></p><p>[]def</p>',
                    });
                    await testEditor(BasicEditor, {
                        // That selection is equivalent to </b>[]
                        contentBefore: '<p><b>abc[]</b>def</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><b>abc</b></p><p>[]def</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>abc[]</b> def</p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible.
                        contentAfter: '<p><b>abc</b></p><p>[]&nbsp;def</p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>abc []</b>def</p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible (because it's before a
                        // <br>).
                        contentAfter: '<p><b>abc&nbsp;</b></p><p>[]def</p>',
                    });
                });
                it('should split a paragraph at the beginning of a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>[]<b>abc</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p><b>[]abc</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        // That selection is equivalent to []<b>
                        contentBefore: '<p><b>[]abc</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><br></p><p><b>[]abc</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>[] abc</b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space should have been parsed away.
                        contentAfter: '<p><br></p><p><b>[]abc</b></p>',
                    });
                });
                it('should split a paragraph within a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>ab[]cd</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><b>ab</b></p><p><b>[]cd</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>ab []cd</b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible.
                        contentAfter: '<p><b>ab&nbsp;</b></p><p><b>[]cd</b></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>ab[] cd</b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space is converted to a non-breaking
                        // space so it is visible.
                        contentAfter: '<p><b>ab</b></p><p><b>[]&nbsp;cd</b></p>',
                    });
                });
                it('should split a paragraph at the end of a format node', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>abc</b>[]</p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><b>abc</b></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        // That selection is equivalent to </b>[]
                        contentBefore: '<p><b>abc[]</b></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter: '<p><b>abc</b></p><p>[]<br></p>',
                    });
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><b>abc[] </b></p>',
                        stepFunction: insertParagraphBreak,
                        // The space should have been parsed away.
                        contentAfter: '<p><b>abc</b></p><p>[]<br></p>',
                    });
                });
            });
            describe('With attributes', () => {
                it('should insert an empty paragraph before a paragraph with a span with a class', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p><span class="a">ab</span></p><p><span class="b">[]cd</span></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter:
                            '<p><span class="a">ab</span></p><p><br></p><p><span class="b">[]cd</span></p>',
                    });
                });
                it('should split a paragraph with a span with a bold in two', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p><span><b>ab[]cd</b></span></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter:
                            '<p><span><b>ab</b></span></p><p><span><b>[]cd</b></span></p>',
                    });
                });
                it('should split a paragraph at its end, with a paragraph after it, and both have the same class', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p class="a">a[]</p><p class="a"><br></p>',
                        stepFunction: insertParagraphBreak,
                        contentAfter:
                            '<p class="a">a</p><p class="a">[]<br></p><p class="a"><br></p>',
                    });
                });
            });
        });
    });
});

/**
 * Quick UI to launch tests from the test web page.
 */
const startTestsButtonEl = document.getElementById('start-tests');
startTestsButtonEl.addEventListener('click', () => {
    startTestsButtonEl.disabled = true;
    const mochaEl = document.createElement('div');
    mochaEl.id = 'mocha';
    document.body.appendChild(mochaEl);
    window.mocha.run(() => {
        const reportEl = document.getElementById('mocha-report');
        window.scrollTo(0, window.scrollY + reportEl.getBoundingClientRect().top);
    });
});
