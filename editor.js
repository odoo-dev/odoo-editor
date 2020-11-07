"use strict";

import {sanitize} from "./sanitize.js";
import {commonParentGet, hasContentAfter} from "./utils/utils.js";
import {parentBlock, setTagName} from "./dom/dom.js";

function callAnchor(method) {
    let sel = document.defaultView.getSelection();
    if (sel.anchorNode.nodeType==Node.TEXT_NODE)
        return sel.anchorNode[method](sel.anchorOffset);

    let node = sel.anchorNode;
    if (sel.anchorOffset)
        node = sel.anchorNode.childNodes[sel.anchorOffset-1]
    return node[method]((node.nodeType==Node.TEXT_NODE)?node.length:0);
}

export class Editor {
    constructor(dom) {
        this.count = 0;
        this.dom = sanitize(dom);
        this.history = [];
        this.last_sanitize = 0;

        this.vdom = dom.cloneNode(true);
        this.idSet(dom, this.vdom);

        dom.setAttribute("contentEditable", true);
        this.observerActive(['characterData']);
        this.dom.addEventListener('keydown', this.keyDown.bind(this));
        document.onselectionchange = this.selectionChange.bind(this);
        this.toolbar = document.querySelector('#toolbar');
        this.toolbar.querySelectorAll('div.btn').forEach((item) => {
            item.onmousedown = this.toolbarClick.bind(this);
        });
    }

    sanitize() {
        // find common ancestror in this.history[this.last_sanitize:]
        let ca, record;
        for (record of this.history.slice(this.last_sanitize)) {
            if (record===null) continue;
            let node = this.idFind(this.dom, record.parentId || record.id) || this.dom;
            ca = ca?commonParentGet(ca, node, this.dom):node;
        }
        if (! ca) return false;

        console.log('sanitizing');

        // sanitize and mark current position as sanitized
        this.last_sanitize = this.history.length;
        sanitize(ca);
    }

    //
    // VDOM Processing
    //
    idSet(src, dest) {
        if (src.count) {
            dest.count = src.count;
        } else {
            src.count = dest.count = ++this.count;
        }
        let childsrc = src.firstChild;
        let childdest = dest.firstChild;
        while (childsrc) {
            this.idSet(childsrc, childdest);
            childsrc = childsrc.nextSibling;
            childdest = childdest.nextSibling;
        }
    }
    idFind(dom, id, parentid) {                        // todo: bissect optim to not traverse the whole tree
        if (dom.count==id && ((!parentid) || dom.parentNode.count==parentid))
            return dom;
        let cur = dom.firstChild;
        while (cur) {
            if (dom.count==id && ((!parentid) || dom.parentNode.count==parentid))
                return dom;
            let result = this.idFind(cur, id, parentid);
            if (result)
                return result;
            cur = cur.nextSibling;
        }
    }


    // Observer that syncs doms
    observerUnactive() {
        this.observer.disconnect();
        this.observerFlush();
    }
    observerFlush() {
        let records = this.observer.takeRecords();
        this.observerApply(this.dom, this.vdom, records);
    }
    observerActive(mode) {
        this.observer = new MutationObserver(records => {
            this.observerApply(this.dom, this.vdom, records);
        });
        this.observer.observe(this.dom, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            characterDataOldValue: true,
        });
    }
    observerApply(srcel, destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": 
                    let node = this.idFind(destel, record.target.count)
                    if (node) {
                        console.log('char ', node.textContent, '->', record.target.textContent);
                        this.history.push({
                            'type': "characterData",
                            'id': record.target.count,
                            "text": record.target.textContent,
                            'time': Date.now(),
                            "oldValue": node.textContent
                        });
                        node.textContent = record.target.textContent;
                    }
                    break
                case "childList":
                    record.removedNodes.forEach( (removed, index) => {
                        console.log('remove', removed);
                        this.history.push({
                            'type': "remove",
                            'id': removed.count,
                            'parentId': record.target.count,
                            'time': Date.now(),
                            'node': removed,
                            'nextId': record.nextSibling ? record.nextSibling.count : undefined,
                            'previousId': record.previousSibling ? record.previousSibling.count : undefined,
                        });
                        let toremove = this.idFind(destel, removed.count, record.target.count);
                        if (toremove)
                            toremove.remove()
                    });
                    record.addedNodes.forEach( (added, index) => {
                        if (! record.target.count) return false;
                        if (added.count && this.idFind(destel, added.count)) {
                            if (record.target.count == this.idFind(destel, added.count).parentNode.count) {
                                return false;
                            }
                        }
                        let newnode = added.cloneNode(1);
                        let action = {
                            'type': "add",
                            'time': Date.now(),
                            'node': newnode,
                        }
                        if (! record.nextSibling) {
                            this.idFind(destel, record.target.count).append(newnode);
                            action['append'] = record.target.count;
                        } else if (record.nextSibling.count) {
                            this.idFind(destel, record.nextSibling.count).before(newnode);
                            action['before'] = record.nextSibling.count;
                        } else if (record.previousSibling.count) {
                            this.idFind(destel, record.previousSibling.count).after(newnode);
                            action['after'] = record.previousSibling.count;
                        } else
                            return false;
                        this.idSet(added, newnode);
                        action['id'] = added.count;
                        action['node'] = newnode;
                        console.log('added', added);
                        this.history.push(action);
                    });
                    break;
                default:
                    console.log('Unknown mutation type: '+record.type)
            }
        }
        if (srcel.innerHTML!=destel.innerHTML) {
            console.log('DOM & vDOM differs');
        }
    }


    // selection handling
    selectionChange(event) {
        let sel = document.defaultView.getSelection();
        if (sel.isCollapsed) {
            this.toolbar.style.visibility = 'hidden';
            return true;
        }
        this.toolbar.style.visibility = 'visible';
        toolbarUpdate();
    }

    toolbarUpdate() {
        this.toolbar.querySelector('#bold').classList.toggle('active', document.queryCommandState("bold"));
        this.toolbar.querySelector('#italic').classList.toggle('active', document.queryCommandState("italic"));
        this.toolbar.querySelector('#underline').classList.toggle('active', document.queryCommandState("underline"));
        this.toolbar.querySelector('#strikeThrough').classList.toggle('active', document.queryCommandState("strikeTrough"));

        let pnode = parentBlock(sel.anchorNode);
        this.toolbar.querySelector('#paragraph').classList.toggle('active', pnode.tagName=='P');
        this.toolbar.querySelector('#heading1').classList.toggle('active', pnode.tagName=='H1');
        this.toolbar.querySelector('#heading2').classList.toggle('active', pnode.tagName=='H2');
        this.toolbar.querySelector('#heading3').classList.toggle('active', pnode.tagName=='H3');
        this.toolbar.querySelector('#blockquote').classList.toggle('active', pnode.tagName=='BLOCKQUOTE');
        this.toolbar.querySelector('#unordered').classList.toggle('active', (pnode.tagName=='LI') && (pnode.parentElement.tagName=="UL"));
        this.toolbar.querySelector('#ordered').classList.toggle('active', (pnode.tagName=='LI') && (pnode.parentElement.tagName=="OL"));
        return true;
    }

    // toolbar handling
    toolbarClick(event) {
        const TAGS= {
            'paragraph': 'p',
            'heading1': 'H1',
            'heading2': 'H2',
            'heading3': 'H3',
            'blockquote': 'BLOCKQUOTE',
            'unordered': 'UL',
            'ordered': 'OL',
        }
        try {
            if (['bold', 'italic', 'underline', 'strikeThrough'].includes(event.toElement.id)) {
                document.execCommand(event.toElement.id);
            } else {
                let sel = document.defaultView.getSelection();
                let pnode = parentBlock(sel.anchorNode);
                setTagName(pnode, TAGS[event.toElement.id]);
            }
            toolbarUpdate();
        } catch(err) {
            if (err.message!='unbreakable') throw err;
            this.historyRollback();
        }
        event.preventDefault();
    }

    // keyboard handling
    keyDown(event) {
        console.log("Keyboard Event "+ event.keyCode);
        this.historyStep();

        let cb = () => {};
        let sel = document.defaultView.getSelection();
        try {
            if (event.keyCode === 13) {                                          // enter key
                event.preventDefault();
                if (! event.shiftKey) {
                    try {
                        callAnchor('oEnter');
                    } catch(err) {
                        if (err.message!='unbreakable') throw err;
                        this.historyRollback();
                        callAnchor('oShiftEnter');
                    }
                } else {
                    callAnchor('oShiftEnter');
                }
            }
            else if (event.keyCode === 8) {                                      // backspace
                event.preventDefault();
                callAnchor('oDeleteBackward');
            }
            else if (event.keyCode === 9 && event.shiftKey) {                    // tab key
                callAnchor('oShiftTab') && event.preventDefault();
            }
            else if (event.keyCode === 9 && !event.shiftKey) {                    // tab key
                callAnchor('oTab') && event.preventDefault();
            }
            else if (event.keyCode === 46) {                                     // delete
                event.preventDefault();
                alert('delete not implemented yet');
            } else if ((event.key == 'z') && event.ctrlKey) {                    // Ctrl Z: Undo
                event.preventDefault();
                this.historyPop();
            }
            else if ((event.key == 'y') && event.ctrlKey) {                      // Ctrl y: redo
                event.preventDefault();
                alert('redo not implemented');
            } 
        } catch(err) {
            if (err.message!='unbreakable') throw err;
            this.historyRollback();
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                // this.sanitize();
                cb();
                this.historyStep();
                resolve(this);
            }, 0);
        });

    }

    //
    // History
    //
    historyStep() {
        if (this.history.length && this.history[this.history.length-1])
            this.history.push(null);
    }

    historyRollback() {
        this.observerFlush();
        if (this.history.length && this.history[this.history.length-1])
            this.historyPop();
    }

    historyPop() {
        while (this.history.length && !this.history[this.history.length-1])
            this.history.pop();

        let pos = this.history.length;
        while (pos && this.history[pos-1])
            pos -= 1;
        let todo = this.history.slice(pos);

        while (todo.length) {
            let action = todo.pop();
            if (!action) break;
            switch (action.type) {
                case "characterData": 
                    this.idFind(this.dom, action.id).textContent = action.oldValue;
                    break;
                case "remove": 
                    if (action.nextId && this.idFind(this.dom, action.nextId)) {
                        this.idFind(this.dom, action.nextId).before(action.node);
                    } else if (action.previousId && this.idFind(this.dom, action.previousId)) {
                        this.idFind(this.dom, action.previousId).after(action.node);
                    } else {
                        this.idFind(this.dom, action.parentId).append(action.node);
                    }
                    break;
                case "add": 
                    let el = this.idFind(this.dom, action.id);
                    if (el) el.remove();
            }
        };
        this.observerFlush();
        while (this.history.length > pos)
            this.history.pop();
    }
}


let editor = new Editor(document.getElementById("dom"));
document.getElementById('vdom').append(editor.vdom)

document.getElementById('domAdd').addEventListener("click", (event) => {
    let newEl = document.createElement('div');
    newEl.innerHTML="This div is in <b>DOM</b> but not in <b>VDOM</b>.";
    editor.observerUnactive();
    editor.dom.querySelector('div,p,li').after(newEl);
    editor.observerActive();
});

document.getElementById('domChange').addEventListener("click", (event) => {
    editor.observerUnactive();
    let li = editor.dom.querySelector('li');
    li.firstChild.nodeValue="Changed in DOM!";
    editor.observerActive();
});

document.getElementById('domReset').addEventListener("click", (event) => {
    editor.observerUnactive();
    let dom = editor.newDom(editor.vdom);
    editor.dom.parentNode.replaceChild(dom, editor.dom);
    editor.dom = dom;
    editor.observerActive();
});

