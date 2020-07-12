"use strict";

import {Sanitize} from "./sanitize.js";
import {commonParentGet} from "./utils.js";

class Editor {
    constructor(dom) {
        this.count = 0;
        this.dom = dom;
        this.history = [];
        this.last_sanitize = 0;

        let s = new Sanitize(dom);
        this.vdom = this.newDom(this.dom);

        this.observer_mode = undefined;
        this.observerActive(['characterData']);
        this.dom.addEventListener('keydown', this.keyDown.bind(this));
    }

    sanitize() {
        console.log('sanitizing');

        // find common ancestror in this.history[this.last_sanitize:]
        let ca;
        for (let record in this.history.slice(this.last_sanitize)) {
            if (record===null) continue;
            let node = this.idFind(this.dom, record.parentId || record.id);
            ca = commonParentGet(ca, node)
        }

        // sanitize and mark current position as sanitized
        this.last_sanitize = this.history.length;
        new Sanitize(ca || this.dom);

    }

    // Observer
    observerUnactive() {
        this.observer.disconnect();
        this.observerFlush();
    }
    observerFlush() {
        let records = this.observer.takeRecords();
        this.observerApply(this.dom, this.vdom, records);
    }
    observerActive(mode) {
        this.observer_mode = mode || ['characterData', 'childList'];
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
            console.log('    doing mutation' + record.type);
            switch (record.type) {
                case "characterData": 
                    let node = this.idFind(destel, record.target.count)
                    if (node) {
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


    //
    // DOM Handling: li
    //

    getLi(sel) {
        let node = sel.anchorNode;
        if (sel.rangeCount) {
            let range = sel.getRangeAt(0);
            if ((range.startContainer.nodeType == 1) && (node.tagName=='UL')) {
                node = range.startContainer.firstChild
                for (let i=0; i<range.startOffset; ++i)
                    if (node.nextSibling)
                        node = node.nextSibling;
            }
        }
        if (node.nodeType==3)
            node = node.parentNode;
        return node.closest('li');
    }

    listIndent(sel) {
        let li = this.getLi(sel);
        let lip = document.createElement("li")
        let ul = document.createElement("ul");
        lip.append(ul);
        lip.style.listStyle = "none";
        li.before(lip);
        ul.append(li);
        this.listSanitize(lip.closest("ul"));

        let range = new Range();
        range.setStart(li,0);
        range.setEnd(li,0);
        sel.removeAllRanges();
        sel.addRange(range);
        return li;
    }

    listOutdent(sel) {
        let li = this.getLi(sel);
        if (li.nextElementSibling) {
            let ul = document.createElement("ul");
            while (li.nextSibling)
                ul.append(li.nextSibling);
            if (li.parentNode.parentNode.tagName == 'LI') {
                let lip = document.createElement("li");
                lip.append(ul);
                lip.style.listStyle = "none";
                li.parentNode.parentNode.after(lip);
            } else
                li.parentNode.after(ul);
        }

        if (li.parentNode.parentNode.tagName == 'LI') {
            let toremove = (! li.previousElementSibling)?li.parentNode.parentNode:null;
            li.parentNode.parentNode.after(li);
            if (toremove) toremove.remove();
        } else {
            let ul = li.parentNode;
            while (li.firstChild)
                li.parentNode.after(li.firstChild);
            li.remove();
            if (! ul.firstElementChild) ul.remove();
        }

        this.listSanitize(li.closest("ul"));

        // duplicate code to remove
        let range = new Range();
        range.setStart(li,0);
        range.setEnd(li,0);
        sel.removeAllRanges();
        sel.addRange(range);
        return li;
    }

    // merge same level siblings
    listSanitize(ul) {
        let li = ul.firstElementChild;
        while (li) {
            if ((li.style.listStyle=="none") && li.nextElementSibling && (li.nextElementSibling.style.listStyle=="none")) {
                let curul = li.firstElementChild;
                let oldul = li.nextElementSibling.firstElementChild;
                while (oldul.firstChild)
                    curul.append(oldul.firstChild);
                li.nextElementSibling.remove();
            }
            li = li.nextElementSibling;
        }
    }

    //
    // keyboard handling
    //

    keyDown(event) {
        console.log('Key Down start ' + this.count + " " + this.observer + " "+ event + " "+event.target);
        this.historyStep();

        let sel = event.target.ownerDocument.defaultView.getSelection();
        // debugger;
        if (event.keyCode === 13) {                   // enter key
            if ((sel.anchorNode.tagName == 'LI') && (! sel.anchorNode.innerText.replace('\n', ''))) {
                event.preventDefault();
                let li = this.listOutdent(sel);
            }
        }
        else if (event.keyCode === 9) {                    // tab key
            event.preventDefault();  // this will prevent us from tabbing out of the editor
            if (this.getLi(sel)) {
                if (event.shiftKey) {
                    let li = this.listOutdent(sel);
                } else {
                    let li = this.listIndent(sel);
                }
            }
        }
        else if ((event.key == 'z') && event.ctrlKey) {                    // Ctrl Z: Undo
            event.preventDefault();
            this.historyPop();
        }
        else if ((event.key == 'y') && event.ctrlKey) {                    // Ctrl y: redo
            event.preventDefault();
            alert('redo not implemented');
        } 

        setTimeout(() => {
            this.sanitize();
            this.historyStep();
        }, 0);

    }

    //
    // VDOM Processing
    //
    idSet(src, dest) {
        console.log("src: "+src.count+", dest:"+dest.count+" - "+(this.count+1));
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
        let cur = dom.firstChild;
        while (cur) {
            if (cur.count==id && ((!parentid) || cur.parentNode.count==parentid))
                return cur;
            let result = this.idFind(cur, id, parentid);
            if (result)
                return result;
            cur = cur.nextSibling;
        }
    }
    newDom(domsrc) {
        let domdest = domsrc.cloneNode(true);
        this.idSet(domsrc, domdest);
        return domdest;
    }


    // History
    historyStep() {
        if (this.history.length && this.history[this.history.length-1])
            this.history.push(null);
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


let editor = new Editor(document.querySelector("[contentEditable=true]"));

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

