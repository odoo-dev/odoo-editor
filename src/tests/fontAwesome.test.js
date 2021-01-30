import { BasicEditor, insertText, testEditor, deleteForward, deleteBackward } from './utils.js';

describe('FontAwesome', () => {
    describe('parse/render', () => {
        it('should parse an old-school fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-star"></i></p>',
                contentAfter: '<p><i class="fa fa-star" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a brand fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fab fa-opera"></i></p>',
                contentAfter: '<p><i class="fab fa-opera" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a duotone fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fad fa-bus-alt"></i></p>',
                contentAfter: '<p><i class="fad fa-bus-alt" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a light fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fab fa-accessible-icon"></i></p>',
                contentAfter:
                    '<p><i class="fab fa-accessible-icon" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a regular fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="far fa-money-bill-alt"></i></p>',
                contentAfter:
                    '<p><i class="far fa-money-bill-alt" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a solid fontawesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i></span></p>',
                contentAfter:
                    '<p><i class="fa fa-pastafarianism" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a fontawesome in a <span>', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><span class="fa fa-pastafarianism"></span></p>',
                contentAfter:
                    '<p><span class="fa fa-pastafarianism" contenteditable="false">​</span></p>',
            });
        });
        it('should parse a fontawesome in a <i>', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i></i></p>',
                contentAfter:
                    '<p><i class="fa fa-pastafarianism" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a fontawesome with more classes', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="red fa bordered fa-pastafarianism big"></i></p>',
                contentAfter:
                    '<p><i class="red fa bordered fa-pastafarianism big" contenteditable="false">​</i></p>',
            });
        });
        it('should parse a fontawesome with multi-line classes', async () => {
            await testEditor(BasicEditor, {
                contentBefore: `<p><i class="fa
                                fa-pastafarianism"></i></p>`,
                contentAfter: `<p><i class="fa
                                fa-pastafarianism" contenteditable="false">​</i></p>`,
            });
        });
        it('should parse a fontawesome with more multi-line classes', async () => {
            await testEditor(BasicEditor, {
                contentBefore: `<p><i class="red fa bordered
                                big fa-pastafarianism scary"></i></p>`,
                contentAfter: `<p><i class="red fa bordered
                                big fa-pastafarianism scary" contenteditable="false">​</i></p>`,
            });
        });
        it('should parse a fontawesome at the beginning of a paragraph', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i>a[b]c</p>',
                contentAfter:
                    '<p><i class="fa fa-pastafarianism" contenteditable="false">​</i>a[b]c</p>',
            });
        });
        it('should parse a fontawesome in the middle of a paragraph', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>a[b]c<i class="fa fa-pastafarianism"></i>def</p>',
                contentAfter:
                    '<p>a[b]c<i class="fa fa-pastafarianism" contenteditable="false">​</i>def</p>',
            });
        });
        it('should parse a fontawesome at the end of a paragraph', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>a[b]c<i class="fa fa-pastafarianism"></i></p>',
                contentAfter:
                    '<p>a[b]c<i class="fa fa-pastafarianism" contenteditable="false">​</i></p>',
            });
        });
        /** not sure this is necessary, keep for now in case it is
        it('should insert navigation helpers when before a fontawesome, in an editable', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>abc[]<i class="fa fa-pastafarianism"></i></p>',
                contentAfter:
                    '<p>abc[]\u200B<i class="fa fa-pastafarianism" contenteditable="false">​</i>\u200B</p>',
            });
            await testEditor(BasicEditor, {
                contentBefore: '<p>[]<i class="fa fa-pastafarianism"></i></p>',
                contentAfter:
                    '<p>\u200B[]<i class="fa fa-pastafarianism" contenteditable="false">​</i>\u200B</p>',
            });
        });
        it('should insert navigation helpers when after a fontawesome, in an editable', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i>[]abc</p>',
                contentAfter:
                    '<p>\u200B<i class="fa fa-pastafarianism" contenteditable="false">​</i>\u200B[]abc</p>',
            });
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i>[]</p>',
                contentAfter:
                    '<p>\u200B<i class="fa fa-pastafarianism" contenteditable="false">​</i>\u200B[]</p>',
            });
        });
        it('should not insert navigation helpers when not adjacent to a fontawesome, in an editable', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[]c<i class="fa fa-pastafarianism"></i></p>',
                contentAfter:
                    '<p>ab[]c<i class="fa fa-pastafarianism" contenteditable="false">​</i></p>',
            });
            await testEditor(BasicEditor, {
                contentBefore: '<p><i class="fa fa-pastafarianism"></i>a[]bc</p>',
                contentAfter:
                    '<p><i class="fa fa-pastafarianism" contenteditable="false">​</i>a[]bc</p>',
            });
        });
        it('should not insert navigation helpers when adjacent to a fontawesome in contenteditable=false container', async () => {
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="false">abc[]<i class="fa fa-pastafarianism"></i></p>',
                contentAfter:
                    '<p contenteditable="false">abc<i class="fa fa-pastafarianism" contenteditable="false">​</i></p>',
            });
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="false"><i class="fa fa-pastafarianism"></i>[]abc</p>',
                contentAfter:
                    '<p contenteditable="false"><i class="fa fa-pastafarianism" contenteditable="false">​</i>abc</p>',
            });
        });
        it('should not insert navigation helpers when adjacent to a fontawesome in contenteditable=false format', async () => {
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="true"><b contenteditable="false">abc[]<i class="fa fa-pastafarianism"></i></b></p>',
                contentAfter:
                    '<p contenteditable="true"><b contenteditable="false">abc<i class="fa fa-pastafarianism" contenteditable="false">​</i></b></p>',
            });
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="true"><b contenteditable="false"><i class="fa fa-pastafarianism"></i>[]abc</b></p>',
                contentAfter:
                    '<p contenteditable="true"><b contenteditable="false"><i class="fa fa-pastafarianism" contenteditable="false">​</i>abc</b></p>',
            });
        });
        it('should not insert navigation helpers when adjacent to a fontawesome in contenteditable=false format (oe-nested)', async () => {
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="true"><a contenteditable="true"><b contenteditable="false">abc[]<i class="fa fa-pastafarianism"></i></b></a></p>',
                contentAfter:
                    '<p contenteditable="true"><a contenteditable="true"><b contenteditable="false">abc<i class="fa fa-pastafarianism" contenteditable="false">​</i></b></a></p>',
            });
            await testEditor(BasicEditor, {
                contentBefore:
                    '<p contenteditable="true"><a contenteditable="true"><b contenteditable="false"><i class="fa fa-pastafarianism"></i>[]abc</b></a></p>',
                contentAfter:
                    '<p contenteditable="true"><a contenteditable="true"><b contenteditable="false"><i class="fa fa-pastafarianism" contenteditable="false">​</i>abc</b></a></p>',
            });
        });*/
    });
    describe('deleteForward', () => {
        describe('Selection collapsed', () => {
            describe('Basic', () => {
                it('should delete a fontawesome', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]<i class="fa fa-pastafarianism"></i>cd</p>',
                        stepFunction: deleteForward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                });
                it('should not delete a fontawesome', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab<i class="fa fa-pastafarianism"></i>[]cd</p>',
                        stepFunction: deleteForward,
                        contentAfter:
                            '<p>ab<i class="fa fa-pastafarianism" contenteditable="false">​</i>[]d</p>',
                    });
                });
                it('should not delete a fontawesome after multiple deleteForward', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]cde<i class="fa fa-pastafarianism"></i>fghij</p>',
                        stepFunction: async editor => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter:
                            '<p>ab[]<i class="fa fa-pastafarianism" contenteditable="false">​</i>fghij</p>',
                    });
                });
                it('should not delete a fontawesome after one deleteForward with spaces', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[] <i class="fa fa-pastafarianism"></i> cd</p>',
                        stepFunction: async editor => {
                            await deleteForward(editor);
                        },
                        contentAfter:
                            '<p>ab[]<i class="fa fa-pastafarianism" contenteditable="false">​</i> cd</p>',
                    });
                });
                it('should not delete a fontawesome after multiple deleteForward with spaces', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>a[]b <i class="fa fa-pastafarianism"></i> cd</p>',
                        stepFunction: async editor => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter:
                            '<p>a[]<i class="fa fa-pastafarianism" contenteditable="false">​</i> cd</p>',
                    });
                });
                it('should not delete a fontawesome after multiple deleteForward with spaces inside a <span>', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<div><span>ab[]c </span><i class="fa fa-star"></i> def</div>',
                        stepFunction: async editor => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter:
                            '<div><span>ab[]</span><i class="fa fa-star" contenteditable="false">​</i> def</div>',
                    });
                });
            });
        });
        describe('Selection not collapsed', () => {
            describe('Basic', () => {
                it('should delete a fontawesome', async () => {
                    // Forward selection
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[<i class="fa fa-pastafarianism"></i>]cd</p>',
                        stepFunction: deleteForward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                    // Backward selection
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab]<i class="fa fa-pastafarianism"></i>[cd</p>',
                        stepFunction: deleteForward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                });
            });
        });
    });
    describe('deleteBackward', () => {
        describe('Selection collapsed', () => {
            describe('Basic', () => {
                it('should delete a fontawesome', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab<i class="fa fa-pastafarianism"></i>[]cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                });
                it('should delete a fontawesome before a span', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p>ab<i class="fa fa-pastafarianism"></i><span>[]cd</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab<span>[]cd</span></p>',
                    });
                });
                it('should not delete a fontawesome before a span', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore:
                            '<p>ab<i class="fa fa-pastafarianism"></i><span>c[]d</span></p>',
                        stepFunction: deleteBackward,
                        contentAfter:
                            '<p>ab<i class="fa fa-pastafarianism" contenteditable="false">​</i><span>[]d</span></p>',
                    });
                });
                it('should not delete a fontawesome', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[]<i class="fa fa-pastafarianism"></i>cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter:
                            '<p>a[]<i class="fa fa-pastafarianism" contenteditable="false">​</i>cd</p>',
                    });
                });
                it('should not delete a fontawesome after multiple deleteBackward', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abcde<i class="fa fa-pastafarianism"></i>fgh[]ij</p>',
                        stepFunction: async editor => {
                            await deleteBackward(editor);
                            await deleteBackward(editor);
                            await deleteBackward(editor);
                        },
                        contentAfter:
                            '<p>abcde<i class="fa fa-pastafarianism" contenteditable="false">​</i>[]ij</p>',
                    });
                });
                it('should not delete a fontawesome after multiple deleteBackward with spaces', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>abcde <i class="fa fa-pastafarianism"></i> fg[]hij</p>',
                        stepFunction: async editor => {
                            await deleteBackward(editor);
                            await deleteBackward(editor);
                            await deleteBackward(editor);
                        },
                        contentAfter:
                            '<p>abcde <i class="fa fa-pastafarianism" contenteditable="false">​</i>[]hij</p>',
                    });
                });
            });
        });
        describe('Selection not collapsed', () => {
            describe('Basic', () => {
                it('should delete a fontawesome', async () => {
                    // Forward selection
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab[<i class="fa fa-pastafarianism"></i>]cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                    // Backward selection
                    await testEditor(BasicEditor, {
                        contentBefore: '<p>ab]<i class="fa fa-pastafarianism"></i>[cd</p>',
                        stepFunction: deleteBackward,
                        contentAfter: '<p>ab[]cd</p>',
                    });
                });
            });
        });
    });
    describe('FontAwesome insertion', () => {
        it('should insert a fontAwesome', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[]cd</p>',
                stepFunction: async editor => {
                    editor._insertFontAwesome('fa fa-star');
                },
                contentAfter: '<p>ab<i class="fa fa-star" contenteditable="false">​</i>[]cd</p>',
            });
        });
        it('should insert a fontAwesome after', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab<i class="fa fa-pastafarianism"></i>c[]d</p>',
                stepFunction: async editor => {
                    editor._insertFontAwesome('fa fa-star');
                },
                contentAfter:
                    '<p>ab<i class="fa fa-pastafarianism" contenteditable="false">​</i>c<i class="fa fa-star" contenteditable="false">​</i>[]d</p>',
            });
        });
        it('should insert a fontAwesome before', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[]<i class="fa fa-pastafarianism"></i>cd</p>',
                stepFunction: async editor => {
                    editor._insertFontAwesome('fa fa-star');
                },
                contentAfter:
                    '<p>ab<i class="fa fa-star" contenteditable="false">​</i>[]<i class="fa fa-pastafarianism" contenteditable="false">​</i>cd</p>',
            });
        });
        it.skip('should insert a fontAwesome and replace the icon', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[<i class="fa fa-pastafarianism"></i>]cd</p>',
                stepFunction: async editor => {
                    editor._insertFontAwesome('fa fa-star');
                },
                contentAfter: '<p>abs<i class="fa fa-star" contenteditable="false">​</i>[]cd</p>',
            });
        });
    });
    describe('Text insertion', () => {
        it('should insert a character before', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[]<i class="fa fa-pastafarianism"></i>cd</p>',
                stepFunction: async editor => {
                    await insertText(editor, 's');
                },
                contentAfter:
                    '<p>abs[]<i class="fa fa-pastafarianism" contenteditable="false">​</i>cd</p>',
            });
        });
        it('should insert a character after', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab<i class="fa fa-pastafarianism"></i>[]cd</p>',
                stepFunction: async editor => {
                    await insertText(editor, 's');
                },
                contentAfter:
                    '<p>ab<i class="fa fa-pastafarianism" contenteditable="false">​</i>s[]cd</p>',
            });
        });
        it.skip('should insert a character and replace the icon', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[<i class="fa fa-pastafarianism"></i>]cd</p>',
                stepFunction: async editor => {
                    await insertText(editor, 's');
                },
                contentAfter: '<p>abs[]cd</p>',
            });
        });
    });
});
